// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Response,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { Roles } from './decorators/roles.decorators';
import { RolesGuard } from './guards/roles.guard';
import { Role } from '../users/enums/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Subscription } from '../platform-admin/entities/subscription.entity';
import { Business } from '../businesses/entities/business.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  // ─── POST /auth/register ─────────────────────────────────────────────────
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Response({ passthrough: true }) res: ExpressResponse) {
    return this.authService.register(dto, res);
  }

  // ─── POST /auth/login ────────────────────────────────────────────────────
  // AuthGuard('local') triggers LocalStrategy.validate() automatically.
  // If validation passes, it puts the user on req.user.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  async login(@Request() req, @Response({ passthrough: true }) res) {
    return this.authService.login(req.user, res);
  }

  // ─── POST /auth/refresh ──────────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req, @Response({ passthrough: true }) res: ExpressResponse) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    
    return this.authService.refreshTokens(refreshToken, res);
  }

  // ─── POST /auth/logout ───────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Response({ passthrough: true }) res: ExpressResponse) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Clear both cookies
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Match the cookie settings
    });
    
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Match the cookie settings
      path: '/auth/refresh',
    });
    
    return { message: 'Logged out successfully' };
  }

  // ─── GET /auth/me ────────────────────────────────────────────────────────
  // Returns the currently logged-in user's info. Frontend uses this on page load.
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Request() req) {
    // Don't send the password_hash to the frontend, ever.
    const { password_hash, ...safeUser } = req.user;
    
    let hasAIAccess = false;
    let planInfo: { name: string; slug: string; ai_enabled: boolean } | null = null;
    let tenantInfo: { id: string; name: string; subscription?: any } | null = null;
    
    // First, try to find tenant by ownerId (for tenant owners)
    let tenant = await this.tenantRepository.findOne({
      where: { ownerId: safeUser.id },
    });
    
    // If not found and user has business_id, find tenant through business
    if (!tenant && safeUser.business_id) {
      const business = await this.businessRepository.findOne({
        where: { id: safeUser.business_id },
        relations: ['tenant'],
      });
      
      if (business) {
        tenant = business.tenant;
      }
    }
    
    if (tenant) {
      const subscription = await this.subscriptionRepository.findOne({
        where: { tenant_id: tenant.id },
        relations: ['plan'],
        order: { created_at: 'DESC' },
      });
      
      if (subscription && subscription.plan) {
        hasAIAccess = subscription.plan.ai_enabled === true;
        planInfo = {
          name: subscription.plan.name,
          slug: subscription.plan.slug,
          ai_enabled: subscription.plan.ai_enabled,
        };
      }
      
      tenantInfo = {
        id: tenant.id,
        name: tenant.name,
        subscription: subscription,
      };
    }
    
    return {
      ...safeUser,
      hasAIAccess,
      plan: planInfo,
      tenant: tenantInfo,
    };
  }

  // ─── GET /auth/roles-demo ────────────────────────────────────────────────
  // A demo endpoint to test that RBAC works. Only PLATFORM_ADMIN can hit this.
  @Get('roles-demo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  async rolesDemoAdmin() {
    return { message: 'You are a Platform Administrator. RBAC works.' };
  }

  // ─── GET /auth/roles-demo-owner ──────────────────────────────────────────
  // Demo: Only BUSINESS_OWNER or PLATFORM_ADMIN can access.
  @Get('roles-demo-owner')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER)
  async rolesDemoOwner() {
    return { message: 'You are a Business Owner or Admin. RBAC works.' };
  }

  // ─── GET /auth/roles-demo-any ────────────────────────────────────────────
  // Demo: Any authenticated user can access (no @Roles decorator = all roles).
  @Get('roles-demo-any')
  @UseGuards(AuthGuard('jwt'))
  async rolesDemoAny(@Request() req) {
    return {
      message: `Logged in as ${req.user.name}. Your role is: ${req.user.role}`,
    };
  }
  // ─── PATCH /auth/profile ─────────────────────────────────────────────────
  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    const { password_hash, ...safeUser } = await this.authService.updateProfile(
      req.user.id,
      dto,
    );
    return safeUser;
  }

  // ─── POST /auth/verify-email ─────────────────────────────────────────────
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  // ─── POST /auth/forgot-password ──────────────────────────────────────────
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If that email exists, a reset link has been sent' };
  }

  // ─── POST /auth/reset-password ───────────────────────────────────────────
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Request() req, @Response() res: ExpressResponse) {
    // Handle Google OAuth callback
    const result = await this.authService.handleOAuthLogin(req.user, res);
    
    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/app/dashboard`);
  }
}