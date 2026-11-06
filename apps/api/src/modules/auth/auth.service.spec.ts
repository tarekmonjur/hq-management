import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRole } from '../../common/enums/user.enum.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

describe('AuthService', () => {
  let userRepository: any;
  let userSessionRepository: any;
  let jwtService: any;
  let configService: any;
  let service: AuthService;

  beforeEach(() => {
    vi.restoreAllMocks();

    userRepository = {
      createQueryBuilder: vi.fn(),
      save: vi.fn(async (user) => user),
      findOne: vi.fn(),
    };

    userSessionRepository = {
      create: vi.fn((session) => ({ ...session, sessionId: 'session-1' })),
      save: vi.fn(async (session) => session),
      findOne: vi.fn(),
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
      get: vi.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string | undefined> = {
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };

        return values[key] ?? defaultValue ?? '15m';
      }),
      getOrThrow: vi.fn((key: string) => {
        if (key === 'JWT_SECRET') {
          return 'abcdefghijklmnopqrstuvwxyz123456';
        }

        return key === 'JWT_REFRESH_EXPIRES_IN' ? '7d' : '15m';
      }),
    };

    service = new AuthService(
      userRepository,
      userSessionRepository,
      jwtService,
      configService,
      { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    );
  });

  it('successful login returns tokens and creates a session', async () => {
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

    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const result = await service.login(
      {
        email: 'admin@example.com',
        password: 'correct-password',
      } as LoginDto,
      {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest' },
      } as any,
    );

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toHaveLength(128);
    expect(userSessionRepository.create).toHaveBeenCalled();
  });

  it('throws invalid credentials when user is not found', async () => {
    userRepository.createQueryBuilder.mockReturnValue({
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.login(
        { email: 'missing@example.com', password: 'password123' } as LoginDto,
        { ip: '127.0.0.1', headers: { 'user-agent': 'vitest' } } as any,
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
  });

  it('increments failed attempts on invalid password', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('correct-password', 10),
      role: UserRole.HQ_ADMIN,
      outletId: 'outlet-1',
      isActive: true,
      failedLoginAttempts: 2,
      lockedUntil: null,
    };

    userRepository.createQueryBuilder.mockReturnValue({
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(user),
    });

    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(
      service.login(
        { email: 'admin@example.com', password: 'wrong-pass' } as LoginDto,
        { ip: '127.0.0.1', headers: { 'user-agent': 'vitest' } } as any,
      ),
    ).rejects.toThrow('Invalid credentials');

    expect(user.failedLoginAttempts).toBe(3);
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('locks account after the fifth failed attempt', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('correct-password', 10),
      role: UserRole.HQ_ADMIN,
      outletId: 'outlet-1',
      isActive: true,
      failedLoginAttempts: 4,
      lockedUntil: null,
    };

    userRepository.createQueryBuilder.mockReturnValue({
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(user),
    });

    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(
      service.login(
        { email: 'admin@example.com', password: 'wrong-pass' } as LoginDto,
        { ip: '127.0.0.1', headers: { 'user-agent': 'vitest' } } as any,
      ),
    ).rejects.toThrow('Invalid credentials');

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toBeInstanceOf(Date);
  });

  it('throws when account is temporarily locked', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('correct-password', 10),
      role: UserRole.HQ_ADMIN,
      outletId: 'outlet-1',
      isActive: true,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60000),
    };

    userRepository.createQueryBuilder.mockReturnValue({
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(user),
    });

    await expect(
      service.login(
        { email: 'admin@example.com', password: 'correct-password' } as LoginDto,
        { ip: '127.0.0.1', headers: { 'user-agent': 'vitest' } } as any,
      ),
    ).rejects.toThrow('Account temporarily locked');
  });

  it('throws when account is disabled', async () => {
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('correct-password', 10),
      role: UserRole.HQ_ADMIN,
      outletId: 'outlet-1',
      isActive: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    userRepository.createQueryBuilder.mockReturnValue({
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(user),
    });

    await expect(
      service.login(
        { email: 'admin@example.com', password: 'correct-password' } as LoginDto,
        { ip: '127.0.0.1', headers: { 'user-agent': 'vitest' } } as any,
      ),
    ).rejects.toThrow('Account is disabled');
  });

  it('refreshes a valid session and rotates refresh token', async () => {
    const oldRefreshHash = await bcrypt.hash('old-refresh', 10);
    const session = {
      sessionId: 'session-1',
      userId: 'user-1',
      refreshTokenHash: oldRefreshHash,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      issuedAt: new Date(),
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.HQ_ADMIN,
        outletId: 'outlet-1',
        isActive: true,
      },
    };

    userSessionRepository.findOne.mockResolvedValue(session);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const result = await service.refresh({
      sessionId: 'session-1',
      refreshToken: 'old-refresh',
    });

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toHaveLength(128);
    expect(session.refreshTokenHash).not.toBe(oldRefreshHash);
    expect(userSessionRepository.save).toHaveBeenCalledWith(session);
  });

  it('throws when refresh session has expired', async () => {
    const session = {
      sessionId: 'session-1',
      userId: 'user-1',
      refreshTokenHash: await bcrypt.hash('old-refresh', 10),
      expiresAt: new Date(Date.now() - 60000),
      revokedAt: null,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.HQ_ADMIN,
        outletId: 'outlet-1',
        isActive: true,
      },
    };

    userSessionRepository.findOne.mockResolvedValue(session);

    await expect(
      service.refresh({
        sessionId: 'session-1',
        refreshToken: 'old-refresh',
      }),
    ).rejects.toThrow('Refresh token expired');
  });

  it('returns null for revoked or expired session validation', async () => {
    userSessionRepository.findOne.mockResolvedValue(null);
    await expect(service.validateSession('session-1')).resolves.toBeNull();
  });

  it('logs out a session by revoking it', async () => {
    const session = { sessionId: 'session-1', revokedAt: null };
    userSessionRepository.findOne.mockResolvedValue(session);

    await service.logout('session-1');

    expect(session.revokedAt).toBeInstanceOf(Date);
    expect(userSessionRepository.save).toHaveBeenCalledWith(session);
  });

  it('revokes all active sessions for a user', async () => {
    const execute = vi.fn();
    const builder = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            andWhere: vi.fn(() => ({ execute })),
          })),
        })),
      })),
    };

    userSessionRepository.createQueryBuilder.mockReturnValue(builder);

    await service.logoutAll('user-1');

    expect(execute).toHaveBeenCalled();
  });
});
