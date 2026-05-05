// src/platform-auth/platform-auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  Response,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimit } from './decorators/rate-limit.decorator';
import {
  PlatformLoginDto,
  PlatformTotpDto,
  PlatformEnableTotpDto,
  PlatformSeedDto,
} from './dto/platform-login.dto';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  // ─── Seed First Platform Admin ───────────────────────────────────────────
  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  async seed(@Body() dto: PlatformSeedDto, @Request() req: ExpressRequest) {
    return this.platformAuthService.seed(dto, req);
  }

  // ─── Login Step 1: Email + Password ──────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }) // 5 attempts per 15 minutes
  async login(
    @Body() dto: PlatformLoginDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.platformAuthService.login(dto, req, res);
  }

  // ─── Login Step 2: TOTP Verification ─────────────────────────────────────
  @Post('login/totp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxAttempts: 5, windowMs: 15 * 60 * 1000 })
  async loginWithTotp(
    @Body() dto: PlatformTotpDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.platformAuthService.loginWithTotp(dto, req, res);
  }

  // ─── Setup TOTP ──────────────────────────────────────────────────────────
  @Post('setup-totp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  async setupTotp(@Request() req: any) {
    return this.platformAuthService.setupTotp(req.user.id);
  }

  // ─── Enable TOTP ─────────────────────────────────────────────────────────
  @Post('enable-totp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  async enableTotp(@Request() req: any, @Body() dto: PlatformEnableTotpDto) {
    return this.platformAuthService.enableTotp(req.user.id, dto);
  }

  // ─── Refresh Tokens ──────────────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = req.cookies?.platform_refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    return this.platformAuthService.refreshTokens(refreshToken, res);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  async logout(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = req.cookies?.platform_refresh_token;
    await this.platformAuthService.logout(refreshToken, res);
    return { message: 'Logged out successfully' };
  }

  // ─── Get Current Admin ───────────────────────────────────────────────────
  @Get('me')
  @UseGuards(PlatformAdminGuard)
  async getMe(@Request() req: any) {
    return this.platformAuthService.getMe(req.user.id);
  }
}
