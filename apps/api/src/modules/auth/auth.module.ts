import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { User, UserSession } from '../../database/entities/index.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { parseDurationToSeconds } from './utils/duration.util.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          issuer: config.get<string>('JWT_ISSUER', 'hq-management-api'),
          audience: config.get<string>('JWT_AUDIENCE', 'hq-management-clients'),
          expiresIn: parseDurationToSeconds(
            config.get<string>('JWT_EXPIRES_IN', '15m'),
          ),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLER_TTL', 60000),
          limit: config.get<number>('THROTTLER_LIMIT', 60),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
