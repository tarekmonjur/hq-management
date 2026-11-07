import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import {
  ApiBadRequestResponse as ApiBadRequestResponseDto,
  ApiTooManyRequestsResponse as ApiTooManyRequestsResponseDto,
  ApiUnauthorizedResponse as ApiUnauthorizedResponseDto,
} from '../../common/dto/api-error-response.dto.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';
import type { AuthTokenPair } from './interfaces/auth-token-pair.interface.js';
import type { SessionSummary } from './interfaces/session-summary.interface.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 15, ttl: 3600000 } }) // 15 per hour
  @ApiOperation({ summary: 'Register an account' })
  @ApiAcceptedResponse({ type: ApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiTooManyRequestsResponseDto })
  async register(@Body() dto: RegisterDto): Promise<{ data: null, message: string }> {
    await this.authService.register(dto);
    return {
      data: null,
      message: 'Registration has been processed successfully.',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 per 15m
  @ApiOperation({ summary: 'Log in' })
  @ApiCreatedResponse({ type: ApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiTooManyRequestsResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthTokenPair> {
    return this.authService.login(dto, req);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per min
  @ApiOperation({ summary: 'Refresh an access token' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiTooManyRequestsResponseDto })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenPair> {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out the current session' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  async logout(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    await this.authService.logout(user.sub, user.sid);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout/all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out every active session' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  async logoutAll(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    await this.authService.logoutAll(user.sub);
    return { message: 'All active sessions revoked successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  async listSessions(
    @CurrentUser() user: JwtPayload,
  ): Promise<SessionSummary[]> {
    return this.authService.listSessions(user.sub, user.sid);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a session' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(user.sub, sessionId);
    return { message: 'Session revoked successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current password' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiBadRequestResponse({ type: ApiBadRequestResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(user.sub, dto);
    return { message: 'Password changed successfully. Please log in again.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user' })
  @ApiOkResponse({ type: ApiResponseDto })
  @ApiUnauthorizedResponse({ type: ApiUnauthorizedResponseDto })
  async me(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getCurrentUser(user.sub);
    return {
      ...profile,
      sessionId: user.sid,
    };
  }
}
