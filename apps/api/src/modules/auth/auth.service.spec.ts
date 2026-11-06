import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../../common/enums/user.enum.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

describe('AuthService', () => {
  let userRepository: any;
  let userSessionRepository: any;
  let jwtService: any;
  let configService: any;
  let dataSource: any;
  let queryRunner: any;
  let service: AuthService;

  beforeEach(() => {
    vi.restoreAllMocks();

    userRepository = {
      createQueryBuilder: vi.fn(),
      save: vi.fn(async (user) => user),
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 'user-created-id' })),
    };

    userSessionRepository = {
      create: vi.fn((session) => ({ ...session, sessionId: 'session-1' })),
      save: vi.fn(async (session) => session),
      findOne: vi.fn(),
      find: vi.fn(),
      update: vi.fn(async () => ({ affected: 1 })),
      createQueryBuilder: vi.fn(() => ({
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              andWhere: vi.fn(() => ({
                execute: vi.fn(),
              })),
            })),
          })),
        })),
      })),
    };

    jwtService = {
      sign: vi.fn(() => 'signed-access-token'),
    };

    configService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const values: Record<string, any> = {
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
          JWT_SESSION_ABSOLUTE_EXPIRES_IN: '30d',
          JWT_ISSUER: 'hq-management-api',
          JWT_AUDIENCE: 'hq-management-clients',
        };
        return values[key] ?? defaultValue;
      }),
      getOrThrow: vi.fn((key: string) => {
        if (key === 'JWT_SECRET') {
          return 'abcdefghijklmnopqrstuvwxyz123456';
        }
        return '15m';
      }),
    };

    queryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      isTransactionActive: true,
      manager: {
        save: vi.fn(async (_entity, data) => data),
        update: vi.fn(async () => ({ affected: 1 })),
        create: vi.fn((_entity, data) => ({ ...data, sessionId: 'session-tx-1' })),
        createQueryBuilder: vi.fn(),
      },
    };

    dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    };

    service = new AuthService(
      userRepository,
      userSessionRepository,
      jwtService,
      configService,
      dataSource,
      { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    );
  });

  describe('register', () => {
    it('creates an active OUTLET_STAFF user with null outletId', async () => {
      userRepository.findOne.mockResolvedValue(null);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-pwd' as never);

      const dto: RegisterDto = {
        email: '  NewUser@example.com  ',
        password: 'Password@123456',
        fullName: '  New User  ',
      };

      await service.register(dto);

      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        fullName: 'New User',
        mobileNo: null,
        passwordHash: 'hashed-pwd',
        role: UserRole.OUTLET_STAFF,
        outletId: null,
        isActive: true,
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('returns generic 202 response without creating duplicate when email exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'existing-id' });
      vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-pwd' as never);

      const dto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password@123456',
        fullName: 'Existing User',
      };

      await service.register(dto);

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('rejects passwords exceeding 72 UTF-8 bytes', async () => {
      const longPassword = 'a'.repeat(73);
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: longPassword,
        fullName: 'Test User',
      };

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('successful login returns token pair and creates a session', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      const user = {
        id: 'user-1',
        email: 'admin@example.com',
        passwordHash,
        role: UserRole.HQ_ADMIN,
        outletId: 'outlet-1',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      };

      userRepository.createQueryBuilder.mockReturnValue({
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login(
        {
          email: 'admin@example.com',
          password: 'correct-password',
          deviceId: 'device-1',
        } as LoginDto,
        { ip: '127.0.0.1', headers: {} } as any,
      );

      expect(result).toHaveProperty('accessToken', 'signed-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('sessionId', 'session-tx-1');
      expect(result).toHaveProperty('tokenType', 'Bearer');
      expect(result).toHaveProperty('expiresIn');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('throws generic UnauthorizedException on unknown user and calls dummy hash', async () => {
      userRepository.createQueryBuilder.mockReturnValue({
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login(
          { email: 'unknown@example.com', password: 'password123' },
          { ip: '127.0.0.1', headers: {} } as any,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(compareSpy).toHaveBeenCalled();
    });

    it('increments failedLoginAttempts on invalid password', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed-pwd',
        failedLoginAttempts: 2,
        lockedUntil: null,
        isActive: true,
      };

      userRepository.createQueryBuilder.mockReturnValue({
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login(
          { email: 'user@example.com', password: 'wrong-password' },
          { ip: '127.0.0.1', headers: {} } as any,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(user.failedLoginAttempts).toBe(3);
      expect(userRepository.save).toHaveBeenCalledWith(user);
    });

    it('locks account after 5 failed login attempts', async () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed-pwd',
        failedLoginAttempts: 4,
        lockedUntil: null,
        isActive: true,
      };

      userRepository.createQueryBuilder.mockReturnValue({
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login(
          { email: 'user@example.com', password: 'wrong-password' },
          { ip: '127.0.0.1', headers: {} } as any,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(user.failedLoginAttempts).toBe(5);
      expect(user.lockedUntil).toBeInstanceOf(Date);
      expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('refresh', () => {
    it('successfully rotates refresh token and returns new token pair', async () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        refreshTokenHash: await bcrypt.hash('old-refresh-token', 10),
        expiresAt: new Date(Date.now() + 100000),
        absoluteExpiresAt: new Date(Date.now() + 500000),
        revokedAt: null,
        user: {
          id: 'user-1',
          email: 'admin@example.com',
          role: UserRole.HQ_ADMIN,
          outletId: null,
          isActive: true,
        },
      };

      queryRunner.manager.createQueryBuilder.mockReturnValue({
        setLock: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(session),
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.refresh({
        sessionId: 'session-1',
        refreshToken: 'valid-43-character-token-123456789012345678',
      } as RefreshTokenDto);

      expect(result).toHaveProperty('accessToken', 'signed-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.sessionId).toBe('session-1');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects expired session and marks it revoked', async () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt: new Date(Date.now() - 10000),
        absoluteExpiresAt: new Date(Date.now() + 500000),
        revokedAt: null,
        user: { id: 'user-1', isActive: true },
      };

      queryRunner.manager.createQueryBuilder.mockReturnValue({
        setLock: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(session),
      });

      await expect(
        service.refresh({
          sessionId: 'session-1',
          refreshToken: 'any-token',
        } as RefreshTokenDto),
      ).rejects.toThrow('Refresh token expired');

      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(queryRunner.manager.save).toHaveBeenCalled();
    });

    it('rejects token mismatch without revoking session', async () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt: new Date(Date.now() + 100000),
        absoluteExpiresAt: new Date(Date.now() + 500000),
        revokedAt: null,
        user: { id: 'user-1', isActive: true },
      };

      queryRunner.manager.createQueryBuilder.mockReturnValue({
        setLock: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(session),
      });

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.refresh({
          sessionId: 'session-1',
          refreshToken: 'wrong-token',
        } as RefreshTokenDto),
      ).rejects.toThrow(UnauthorizedException);

      expect(session.revokedAt).toBeNull();
    });
  });

  describe('logout and session management', () => {
    it('logout revokes specific session for user', async () => {
      await service.logout('user-1', 'session-1');
      expect(userSessionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('logoutAll revokes all sessions for user', async () => {
      await service.logoutAll('user-1');
      expect(userSessionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('listSessions returns sessions with isCurrent flag', async () => {
      const sessions = [
        {
          sessionId: 'session-1',
          deviceId: 'dev-1',
          deviceName: 'Phone',
          deviceType: 'mobile',
          os: 'iOS',
          browser: 'Safari',
          ipAddress: '127.0.0.1',
          userAgent: 'Agent',
          issuedAt: new Date(),
          expiresAt: new Date(),
          absoluteExpiresAt: new Date(),
        },
        {
          sessionId: 'session-2',
          deviceId: 'dev-2',
          deviceName: 'Laptop',
          deviceType: 'desktop',
          os: 'macOS',
          browser: 'Chrome',
          ipAddress: '127.0.0.1',
          userAgent: 'Agent',
          issuedAt: new Date(),
          expiresAt: new Date(),
          absoluteExpiresAt: new Date(),
        },
      ];

      userSessionRepository.find.mockResolvedValue(sessions);

      const list = await service.listSessions('user-1', 'session-1');
      expect(list).toHaveLength(2);
      expect(list[0].isCurrent).toBe(true);
      expect(list[1].isCurrent).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('successfully changes password and revokes all active sessions', async () => {
      const currentHash = await bcrypt.hash('old-password-123', 10);
      const user = {
        id: 'user-1',
        passwordHash: currentHash,
        passwordChangedAt: null,
      };

      userRepository.createQueryBuilder.mockReturnValue({
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
      });

      vi.spyOn(bcrypt, 'compare')
        .mockResolvedValueOnce(true as never) // current password matches
        .mockResolvedValueOnce(false as never); // new password is not same as current

      const dto: ChangePasswordDto = {
        currentPassword: 'old-password-123',
        newPassword: 'NewPassword@123456',
      };

      await service.changePassword('user-1', dto);

      expect(queryRunner.manager.save).toHaveBeenCalled();
      expect(queryRunner.manager.update).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects if new password equals current password', async () => {
      const currentHash = await bcrypt.hash('same-password-123', 10);
      const user = {
        id: 'user-1',
        passwordHash: currentHash,
      };

      userRepository.createQueryBuilder.mockReturnValue({
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(user),
      });

      vi.spyOn(bcrypt, 'compare')
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never); // same password

      const dto: ChangePasswordDto = {
        currentPassword: 'same-password-123',
        newPassword: 'same-password-123',
      };

      await expect(service.changePassword('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateSession', () => {
    it('returns session when active, not expired, and user is active', async () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 100000),
        absoluteExpiresAt: new Date(Date.now() + 500000),
        user: { id: 'user-1', isActive: true },
      };

      userSessionRepository.findOne.mockResolvedValue(session);

      const result = await service.validateSession('session-1', 'user-1');
      expect(result).toBe(session);
    });

    it('returns null if session belongs to another user', async () => {
      const session = {
        sessionId: 'session-1',
        userId: 'other-user',
        expiresAt: new Date(Date.now() + 100000),
        absoluteExpiresAt: new Date(Date.now() + 500000),
        user: { id: 'other-user', isActive: true },
      };

      userSessionRepository.findOne.mockResolvedValue(session);

      const result = await service.validateSession('session-1', 'user-1');
      expect(result).toBeNull();
    });

    it('returns null and revokes session if expired', async () => {
      const session = {
        sessionId: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        absoluteExpiresAt: new Date(Date.now() + 500000),
        user: { id: 'user-1', isActive: true },
      };

      userSessionRepository.findOne.mockResolvedValue(session);

      const result = await service.validateSession('session-1', 'user-1');
      expect(result).toBeNull();
      expect(userSessionRepository.save).toHaveBeenCalled();
    });
  });
});
