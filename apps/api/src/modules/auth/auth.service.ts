import { randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';
import { IsNull, Repository } from 'typeorm';
import type { Request } from 'express';

import { User, UserSession } from '../../database/entities/index.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
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
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const rawRefreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const refreshExpiresAt = new Date(
      Date.now() +
        this.parseDurationToMs(
          this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
        ),
    );

    const session = this.userSessionRepository.create({
      userId: user.id,
      user,
      refreshTokenHash,
      deviceId: dto.deviceId ?? null,
      deviceName: dto.deviceName ?? null,
      deviceType: dto.deviceType ?? null,
      ipAddress: dto.ipAddress ?? null,
      userAgent: dto.userAgent ?? null,
      issuedAt: new Date(),
      expiresAt: refreshExpiresAt,
    });

    await this.userSessionRepository.save(session);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.sessionId,
      outletId: user.outletId ?? null,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: rawRefreshToken,
    };
  }

  async refresh(
    dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await this.userSessionRepository.findOne({
      where: {
        sessionId: dto.sessionId,
        revokedAt: IsNull(),
      },
      relations: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    if (session.expiresAt < new Date()) {
      session.revokedAt = new Date();
      await this.userSessionRepository.save(session);
      throw new UnauthorizedException('Refresh token expired');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user =
      session.user ??
      (await this.userRepository.findOne({ where: { id: session.userId } }));

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const rawRefreshToken = randomBytes(64).toString('hex');
    const refreshExpiration = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const expiresAt = new Date(
      Date.now() + this.parseDurationToMs(refreshExpiration),
    );

    session.refreshTokenHash = await bcrypt.hash(rawRefreshToken, 10);
    session.expiresAt = expiresAt;
    session.issuedAt = new Date();
    await this.userSessionRepository.save(session);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.sessionId,
      outletId: user.outletId ?? null,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: rawRefreshToken,
    };
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.userSessionRepository.findOne({
      where: { sessionId },
    });

    if (!session || session.revokedAt) {
      return;
    }

    session.revokedAt = new Date();
    await this.userSessionRepository.save(session);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.userSessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async validateSession(sessionId: string): Promise<UserSession | null> {
    const session = await this.userSessionRepository.findOne({
      where: {
        sessionId,
        revokedAt: IsNull(),
      },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt <= new Date()) {
      session.revokedAt = new Date();
      await this.userSessionRepository.save(session);
      return null;
    }

    return session;
  }

  private parseDurationToMs(value: string): number {
    const match = value.trim().match(/^(\d+)([smhd])$/i);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const durations = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * (durations[unit as keyof typeof durations] ?? 60 * 1000);
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
