// src/platform-auth/platform-auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response, Request } from 'express';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { PlatformAdmin } from './entities/platform-admin.entity';
import { PlatformRefreshToken } from './entities/platform-refresh-token.entity';
import { PlatformLoginAttempt } from './entities/platform-login-attempt.entity';
import {
  PlatformLoginDto,
  PlatformTotpDto,
  PlatformEnableTotpDto,
  PlatformSeedDto,
} from './dto/platform-login.dto';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(PlatformAdmin)
    private readonly adminRepo: Repository<PlatformAdmin>,
    @InjectRepository(PlatformRefreshToken)
    private readonly refreshTokenRepo: Repository<PlatformRefreshToken>,
    @InjectRepository(PlatformLoginAttempt)
    private readonly loginAttemptRepo: Repository<PlatformLoginAttempt>,
  ) {}

  // ─── Log Login Attempt ───────────────────────────────────────────────────
  private async logLoginAttempt(
    email: string,
    ip: string,
    success: boolean,
    failureReason?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.loginAttemptRepo.save({
      email,
      ip_address: ip,
      success,
      failure_reason: failureReason,
      user_agent: userAgent,
    });
  }

  // ─── Seed First Platform Admin ───────────────────────────────────────────
  async seed(dto: PlatformSeedDto, req: Request): Promise<{ message: string }> {
    const seedEnabled = this.configService.get<string>('PLATFORM_SEED_ENABLED') === 'true';

    if (!seedEnabled) {
      throw new ForbiddenException('Platform admin seeding is disabled');
    }

    // Check if any admin already exists
    const existingAdmin = await this.adminRepo.findOne({ where: {} });
    if (existingAdmin) {
      throw new BadRequestException('Platform admin already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const admin = this.adminRepo.create({
      email: dto.email,
      password_hash: hashedPassword,
      totp_enabled: false,
    });

    await this.adminRepo.save(admin);

    await this.logLoginAttempt(
      dto.email,
      req.ip || 'unknown',
      true,
      undefined,
      req.headers['user-agent'],
    );

    return { message: 'Platform admin created successfully. Please disable PLATFORM_SEED_ENABLED.' };
  }

  // ─── Login Step 1: Email + Password ──────────────────────────────────────
  async login(
    dto: PlatformLoginDto,
    req: Request,
    res: Response,
  ): Promise<{ message: string; totp_required?: boolean }> {
    const admin = await this.adminRepo.findOne({
      where: { email: dto.email },
    });

    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];

    // Generic error message to prevent email enumeration
    const genericError = 'Invalid credentials';

    if (!admin) {
      await this.logLoginAttempt(dto.email, ip, false, 'Email not found', userAgent);
      throw new UnauthorizedException(genericError);
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.password_hash);

    if (!passwordMatches) {
      await this.logLoginAttempt(dto.email, ip, false, 'Invalid password', userAgent);
      throw new UnauthorizedException(genericError);
    }

    // If TOTP is enabled, require second step
    if (admin.totp_enabled) {
      return {
        message: 'TOTP verification required',
        totp_required: true,
      };
    }

    // No TOTP, issue tokens immediately
    await this.generateTokensAndSetCookies(admin, res);
    admin.last_login_at = new Date();
    await this.adminRepo.save(admin);

    await this.logLoginAttempt(dto.email, ip, true, undefined, userAgent);

    return { message: 'Login successful' };
  }

  // ─── Login Step 2: TOTP Verification ─────────────────────────────────────
  async loginWithTotp(
    dto: PlatformTotpDto,
    req: Request,
    res: Response,
  ): Promise<{ message: string }> {
    const admin = await this.adminRepo.findOne({
      where: { email: dto.email },
    });

    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'];

    if (!admin || !admin.totp_enabled || !admin.totp_secret) {
      await this.logLoginAttempt(dto.email, ip, false, 'TOTP not enabled', userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    const verified = speakeasy.totp.verify({
      secret: admin.totp_secret,
      encoding: 'base32',
      token: dto.code,
      window: 2, // Allow 2 time steps before/after
    });

    if (!verified) {
      await this.logLoginAttempt(dto.email, ip, false, 'Invalid TOTP code', userAgent);
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.generateTokensAndSetCookies(admin, res);
    admin.last_login_at = new Date();
    await this.adminRepo.save(admin);

    await this.logLoginAttempt(dto.email, ip, true, undefined, userAgent);

    return { message: 'Login successful' };
  }

  // ─── Setup TOTP ──────────────────────────────────────────────────────────
  async setupTotp(adminId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    if (admin.totp_enabled) {
      throw new BadRequestException('TOTP is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `NovEntra Platform (${admin.email})`,
      issuer: 'NovEntra',
    });

    // Save secret but don't enable yet
    admin.totp_secret = secret.base32;
    await this.adminRepo.save(admin);

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  // ─── Enable TOTP ─────────────────────────────────────────────────────────
  async enableTotp(adminId: string, dto: PlatformEnableTotpDto): Promise<{ message: string }> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    if (admin.totp_enabled) {
      throw new BadRequestException('TOTP is already enabled');
    }

    if (!admin.totp_secret) {
      throw new BadRequestException('TOTP setup not initiated. Call /setup-totp first.');
    }

    const verified = speakeasy.totp.verify({
      secret: admin.totp_secret,
      encoding: 'base32',
      token: dto.code,
      window: 2,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid verification code');
    }

    admin.totp_enabled = true;
    await this.adminRepo.save(admin);

    return { message: 'TOTP enabled successfully' };
  }

  // ─── Refresh Tokens ──────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string, res: Response): Promise<{ message: string }> {
    const tokenRecord = await this.refreshTokenRepo.findOne({
      where: { token: refreshToken },
      relations: ['admin'],
    });

    if (!tokenRecord || tokenRecord.is_revoked || tokenRecord.expires_at < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await this.refreshTokenRepo.update(tokenRecord.id, { is_revoked: true });

    // Issue new tokens
    await this.generateTokensAndSetCookies(tokenRecord.admin, res);

    return { message: 'Tokens refreshed successfully' };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────
  async logout(refreshToken: string, res: Response): Promise<void> {
    if (refreshToken) {
      const tokenRecord = await this.refreshTokenRepo.findOne({
        where: { token: refreshToken },
      });
      if (tokenRecord) {
        await this.refreshTokenRepo.update(tokenRecord.id, { is_revoked: true });
      }
    }

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.clearCookie('platform_access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Allow cross-site cookies for different domains
    });

    res.clearCookie('platform_refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Allow cross-site cookies for different domains
      path: '/platform/auth/refresh',
    });
  }

  // ─── Get Current Admin ───────────────────────────────────────────────────
  async getMe(adminId: string): Promise<Omit<PlatformAdmin, 'password_hash' | 'totp_secret'>> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const { password_hash, totp_secret, ...safeAdmin } = admin;
    return safeAdmin;
  }

  // ─── Generate Tokens and Set Cookies ─────────────────────────────────────
  private async generateTokensAndSetCookies(admin: PlatformAdmin, res: Response): Promise<void> {
    const payload = {
      sub: admin.id,
      email: admin.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('PLATFORM_JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours

    await this.refreshTokenRepo.save({
      token: refreshToken,
      admin_id: admin.id,
      expires_at: expiresAt,
    });

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('platform_access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Allow cross-site cookies for different domains
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('platform_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Allow cross-site cookies for different domains
      path: '/platform/auth/refresh',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });
  }
}
