import { randomBytes, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import { DataSource, IsNull, Repository } from 'typeorm';
import type { Request } from 'express';

import { UserRole } from '../../common/enums/user.enum.js';
import { Company, User, UserSession, Outlet } from '../../database/entities/index.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { AuthTokenPair } from './interfaces/auth-token-pair.interface.js';
import { SessionSummary } from './interfaces/session-summary.interface.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import {
  parseDurationToMs,
  parseDurationToSeconds,
} from './utils/duration.util.js';

const DUMMY_BCRYPT_HASH =
  '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) { }

  async register(dto: RegisterDto): Promise<void> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const trimmedFullName = dto.fullName?.trim();

    if (!trimmedFullName) {
      throw new BadRequestException('Full name is required');
    }

    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException(
        'Password exceeds maximum allowed byte length of 72 bytes',
      );
    }

    // Hash password first so timing does not leak whether account exists
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return;
    }

    if (dto.role !== UserRole.SUPER_ADMIN && !dto.companyId) {
      throw new BadRequestException('Company ID is required');
    }

    if (dto.role !== UserRole.HQ_ADMIN && !dto.outletId) {
      throw new BadRequestException('Either role or outlet ID is required');
    }

    let companyId = dto.companyId ?? null;

    if (companyId) {
      const company = await this.companyRepository.findOne({
        where: { id: companyId },
      });
      if (!company) {
        throw new BadRequestException('Company not found');
      }
    }

    if (dto.role !== UserRole.HQ_ADMIN) {
      if (!dto.outletId) {
        throw new BadRequestException('Outlet ID is required for outlet user');
      }
      const outlet = await this.outletRepository.findOne({
        where: { id: dto.outletId },
      });
      if (!outlet) {
        throw new BadRequestException('Outlet not found');
      }
      if (companyId && outlet.companyId !== companyId) {
        throw new BadRequestException('Outlet does not belong to the company');
      }
      companyId = companyId ?? outlet.companyId;
    }

    try {
      const user = this.userRepository.create({
        email: normalizedEmail,
        fullName: trimmedFullName,
        mobileNo: dto.mobileNo?.trim() || null,
        passwordHash,
        role: dto.role || UserRole.OUTLET_STAFF,
        companyId,
        outletId: dto.outletId || null,
        isActive: true,
      });

      await this.userRepository.save(user);
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate key')) {
        return;
      }
      throw err;
    }
  }

  async login(dto: LoginDto, req: Request): Promise<AuthTokenPair> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await bcrypt.compare(dto.password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await bcrypt.compare(dto.password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset stale lockout counter if prior lock expired
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      const nextFailedAttempts = (user.failedLoginAttempts ?? 0) + 1;
      user.failedLoginAttempts = nextFailedAttempts;

      if (nextFailedAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();

    const rawRefreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);

    const refreshIdleMs = parseDurationToMs(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
    const absoluteMs = parseDurationToMs(
      this.configService.get<string>(
        'JWT_SESSION_ABSOLUTE_EXPIRES_IN',
        '30d',
      ),
    );

    const now = Date.now();
    const absoluteExpiresAt = new Date(now + absoluteMs);
    const expiresAt = new Date(
      Math.min(now + refreshIdleMs, absoluteExpiresAt.getTime()),
    );

    const ipAddress = this.getClientIp(req);
    const userAgent = this.getUserAgent(req);

    let session: UserSession;

    // Use transaction to revoke same device session and persist user + new session
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(User, user);

      if (dto.deviceId) {
        await queryRunner.manager.update(
          UserSession,
          {
            userId: user.id,
            deviceId: dto.deviceId,
            revokedAt: IsNull(),
          },
          { revokedAt: new Date() },
        );
      }

      session = queryRunner.manager.create(UserSession, {
        userId: user.id,
        refreshTokenHash,
        deviceId: dto.deviceId ?? null,
        deviceName: dto.deviceName ?? null,
        deviceType: dto.deviceType ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        issuedAt: new Date(),
        expiresAt,
        absoluteExpiresAt,
      });

      await queryRunner.manager.save(UserSession, session);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.sessionId,
      outletId: user.outletId ?? null,
      companyId: user.companyId ?? null,
      jti,
    };

    const expiresIn = parseDurationToSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
    );

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: rawRefreshToken,
      sessionId: session.sessionId,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokenPair> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const session = await queryRunner.manager
        .createQueryBuilder(UserSession, 'session')
        .setLock('pessimistic_write')
        .addSelect('session.refreshTokenHash')
        .innerJoinAndSelect('session.user', 'user')
        .where('session.sessionId = :sessionId', { sessionId: dto.sessionId })
        .getOne();

      if (!session || session.revokedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const now = new Date();
      if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
        session.revokedAt = now;
        await queryRunner.manager.save(UserSession, session);
        await queryRunner.commitTransaction();
        throw new UnauthorizedException('Refresh token expired');
      }

      const isRefreshTokenValid = await bcrypt.compare(
        dto.refreshToken,
        session.refreshTokenHash,
      );

      if (!isRefreshTokenValid) {
        // Do not revoke session on token mismatch
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = session.user;
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Account is disabled');
      }

      const newRawRefreshToken = randomBytes(32).toString('base64url');
      const newHash = await bcrypt.hash(newRawRefreshToken, 10);

      const refreshIdleMs = parseDurationToMs(
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      );
      const newExpiresAt = new Date(
        Math.min(
          Date.now() + refreshIdleMs,
          session.absoluteExpiresAt.getTime(),
        ),
      );

      session.refreshTokenHash = newHash;
      session.expiresAt = newExpiresAt;
      session.issuedAt = new Date();

      await queryRunner.manager.save(UserSession, session);
      await queryRunner.commitTransaction();

      const jti = randomUUID();
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        sid: session.sessionId,
        outletId: user.outletId ?? null,
        companyId: user.companyId ?? null,
        jti,
      };

      const expiresIn = parseDurationToSeconds(
        this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      );

      return {
        accessToken: this.jwtService.sign(payload),
        refreshToken: newRawRefreshToken,
        sessionId: session.sessionId,
        tokenType: 'Bearer',
        expiresIn,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.userSessionRepository.update(
      { sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.userSessionRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async getCurrentUser(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    outletId: string | null;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      outletId: user.outletId ?? null,
    };
  }

  async listSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionSummary[]> {
    const sessions = await this.userSessionRepository.find({
      where: { userId },
      order: { issuedAt: 'DESC' },
    });

    return sessions.map((s) => ({
      sessionId: s.sessionId,
      deviceId: s.deviceId,
      deviceName: s.deviceName ?? null,
      deviceType: s.deviceType ?? null,
      os: s.os ?? null,
      browser: s.browser ?? null,
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
      issuedAt: s.issuedAt,
      expiresAt: s.expiresAt,
      absoluteExpiresAt: s.absoluteExpiresAt,
      isCurrent: s.sessionId === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.userSessionRepository.update(
      { sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) {
      throw new BadRequestException(
        'New password exceeds maximum allowed byte length of 72 bytes',
      );
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    user.passwordHash = newHash;
    user.passwordChangedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(User, user);
      await queryRunner.manager.update(
        UserSession,
        { userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async validateSession(
    sessionId: string,
    userId: string,
  ): Promise<UserSession | null> {
    const session = await this.userSessionRepository.findOne({
      where: { sessionId, revokedAt: IsNull() },
      relations: { user: true },
    });

    if (!session || session.userId !== userId) {
      return null;
    }

    const now = new Date();
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      session.revokedAt = now;
      await this.userSessionRepository.save(session);
      return null;
    }

    if (!session.user || !session.user.isActive) {
      return null;
    }

    return session;
  }

  getClientIp(req: Request): string | null {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0]?.split(',')[0]?.trim() ?? req.ip ?? null;
    }

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim() ?? req.ip ?? null;
    }

    return req.ip ?? null;
  }

  getUserAgent(req: Request): string | undefined {
    const userAgent = req.headers['user-agent'];

    if (Array.isArray(userAgent)) {
      return userAgent[0] ?? undefined;
    }

    return userAgent ?? undefined;
  }
}
