// src/auth/auth.service.ts
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { PasswordResetToken, TokenType } from './entities/password-reset-token.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from '../email/email.service';
import { Role } from 'src/users/enums/role.enum';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { TaxRate } from '../businesses/entities/tax-rate.entity';
import { TenantRegistrationService } from '../platform-admin/services/tenant-registration.service';

@Injectable()
export class AuthService {

constructor(
  private readonly usersService: UsersService,
  private readonly jwtService: JwtService,
  private readonly configService: ConfigService,
  private readonly emailService: EmailService,
  @InjectRepository(RefreshToken)
  private readonly refreshTokenRepo: Repository<RefreshToken>,
  @InjectRepository(PasswordResetToken)
  private readonly resetTokenRepo: Repository<PasswordResetToken>,
  @InjectRepository(User)
  private readonly usersRepository: Repository<User>,
  @InjectRepository(Tenant)
  private readonly tenantsRepository: Repository<Tenant>,
  @InjectRepository(Business)
  private readonly businessesRepository: Repository<Business>,
  @InjectRepository(BusinessMember)
  private readonly businessMembersRepository: Repository<BusinessMember>,
  @InjectRepository(TaxRate)
  private readonly taxRatesRepository: Repository<TaxRate>,
  private readonly tenantRegistrationService: TenantRegistrationService,
) {}

  // ─── Called by LocalStrategy during login ─────────────────────────────────
async validateUser(email: string, password: string): Promise<User | null> {
    console.log('=== validateUser called ===');
    console.log('Email received:', email);
    console.log('Password received:', password);

    const user = await this.usersService.findByEmail(email);
    console.log('User found in DB:', user ? 'YES' : 'NO');

    if (!user) {
      console.log('Returning null — user not found');
      return null;
    }

    console.log('Stored password_hash:', user.password_hash);
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    console.log('Password matches:', passwordMatches);

    if (!passwordMatches) {
      console.log('Returning null — password mismatch');
      return null;
    }

    // Check if user is suspended at the user level (tenant suspension)
    if (user.is_suspended) {
      console.log('Throwing exception — user account is suspended (tenant suspension)');
      throw new UnauthorizedException('Your account has been suspended. Please contact support for assistance.');
    }

    console.log('Returning user — success');
    return user;
  }

  // ─── Registration ────────────────────────────────────────────────────────
 

// src/auth/auth.service.ts
async register(registerDto: RegisterDto, res: Response) {
  // Use queryRunner for transaction
  const queryRunner = this.usersRepository.manager.connection.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Check if user already exists (inside transaction to prevent race conditions)
    const existingUser = await queryRunner.manager.findOne(User, {
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // 2. Create the user
    // 🔐 Security: Use 12 rounds for bcrypt (more secure)
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = queryRunner.manager.create(User, {
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password_hash: hashedPassword,
      phone: registerDto.phone_number,
      role: Role.BUSINESS_OWNER,
      is_verified: false,
      is_suspended: false,
    });
    await queryRunner.manager.save(user);

    // 3. Create the tenant
    const tenant = queryRunner.manager.create(Tenant, {
      name: registerDto.tenant.name,
      domain: registerDto.tenant.domain,
      contactEmail: registerDto.tenant.contactEmail || registerDto.email,
      description: registerDto.tenant.description,
      ownerId: user.id,
      settings: {},
      billingPlan: 'free', // Default billing plan
    });
    await queryRunner.manager.save(tenant);

    // 4. Create the business
    const business = queryRunner.manager.create(Business, {
      tenant_id: tenant.id,
      name: registerDto.business.name,
      logo: registerDto.business.logo,
      tax_id: registerDto.business.tax_id,
      currency: registerDto.business.currency || 'TND',
      address: registerDto.business.address,
      email: registerDto.business.email || registerDto.email,
    });
    await queryRunner.manager.save(business);

    // 4.5. Add the business owner as a member in business_members table
    const businessMember = queryRunner.manager.create(BusinessMember, {
      business_id: business.id,
      user_id: user.id,
      role: Role.BUSINESS_OWNER,
      is_active: true,
      joined_at: new Date(),
      collaboration_permissions: {},
      stock_permissions: {},
    });
    await queryRunner.manager.save(businessMember);

    // 5. Create the default tax rate
    const taxRate = queryRunner.manager.create(TaxRate, {
      business_id: business.id,
      name: registerDto.taxRate.name,
      rate: registerDto.taxRate.rate,
      is_default: registerDto.taxRate.is_default,
    });
    await queryRunner.manager.save(taxRate);

    // 6. Create email verification token
    const verificationToken = uuidv4();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 24); // 24 hours

    const resetToken = queryRunner.manager.create(PasswordResetToken, {
      token: verificationToken,
      user_id: user.id,
      type: TokenType.EMAIL_VERIFICATION,
      expires_at,
      is_used: false,
    });
    await queryRunner.manager.save(resetToken);

    // 7. Commit transaction
    await queryRunner.commitTransaction();

    // 8. Create tenant approval and subscription
    await this.tenantRegistrationService.createTenantApprovalAndSubscription(
      tenant.id,
      registerDto.planId,
      registerDto.billingCycle
    );

    // 9. Send verification email (after commit, so we don't send email if transaction fails)
    const fullName = `${user.firstName} ${user.lastName}`;
    await this.emailService.sendVerificationEmail(user.email, verificationToken, fullName);

    // 10. Return success response WITHOUT generating tokens
    // User must log in manually to get tokens
    return {
      message: 'Registration successful. Please log in with your credentials.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        is_verified: user.is_verified,
      },
    };
  } catch (error: any) {
    // Rollback on error
    await queryRunner.rollbackTransaction();
    console.error('Registration error:', error);
    throw new BadRequestException('Failed to register user: ' + (error?.message || 'Unknown error'));
  } finally {
    // Release queryRunner
    await queryRunner.release();
  }
}
  // ─── Login ───────────────────────────────────────────────────────────────
  // This is called AFTER LocalStrategy already validated the user
  async login(user: User, res: Response): Promise<{ message: string; user: any }> {
    // Check tenant login permission (approval and subscription status)
    if (user.role !== 'PLATFORM_ADMIN') {
      // Find user's tenant (if they're a business owner)
      const tenant = await this.tenantsRepository.findOne({
        where: { ownerId: user.id },
      });

      if (tenant) {
        // User is a tenant owner - check tenant approval and subscription
        const loginCheck = await this.tenantRegistrationService.checkTenantLoginPermission(tenant.id);
        
        if (!loginCheck.canLogin) {
          throw new UnauthorizedException(loginCheck.message);
        }
      } else {
        // User is not a tenant owner, check if they're a business member
        const membership = await this.businessMembersRepository.findOne({
          where: { 
            user_id: user.id,
            is_active: true,
          },
        });

        // If no active membership found, check if they have an inactive one
        if (!membership) {
          const inactiveMembership = await this.businessMembersRepository.findOne({
            where: { 
              user_id: user.id,
              is_active: false,
            },
          });

          // If they have an inactive membership, this is a subscription issue
          // (not a tenant suspension, because user.is_suspended would have been caught earlier)
          if (inactiveMembership) {
            throw new UnauthorizedException('Your subscription has been suspended or cancelled. Please contact support for assistance.');
          }
        }
      }
    }

    await this.generateTokensAndSetCookies(user, res);
    
    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string, res: Response): Promise<{ message: string; user: any }> {
    // Find the refresh token in DB
    const tokenRecord = await this.refreshTokenRepo.findOne({
      where: { token: refreshToken },
      relations: ['user'],
    });

    // If not found, revoked, or expired → reject
    if (!tokenRecord || tokenRecord.is_revoked || tokenRecord.expires_at < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke the old refresh token (rotation — each refresh gives a new one)
    await this.refreshTokenRepo.update(tokenRecord.id, { is_revoked: true });

    // Issue brand new tokens and set cookies
    await this.generateTokensAndSetCookies(tokenRecord.user, res);

    return {
      message: 'Tokens refreshed successfully',
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        firstName: tokenRecord.user.firstName,
        lastName: tokenRecord.user.lastName,
        role: tokenRecord.user.role,
      },
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────
  async logout(refreshToken: string): Promise<void> {
    const tokenRecord = await this.refreshTokenRepo.findOne({
      where: { token: refreshToken },
    });
    if (tokenRecord) {
      await this.refreshTokenRepo.update(tokenRecord.id, { is_revoked: true });
    }
  }


// ─── Token Generation (private helper) ──────────────────────────────────
  private async generateTokens(user: User): Promise<{ access_token: string; refresh_token: string }> {

    // ── Trouver le business_id lié à cet utilisateur ─────────────────
    let business_id: string | null = null;

    try {
      // First, check if user is a business owner (has a tenant)
      const tenant = await this.tenantsRepository.findOne({
        where: { ownerId: user.id },
      });

      if (tenant) {
        const business = await this.businessesRepository.findOne({
          where: { tenant_id: tenant.id },
          order: { created_at: 'ASC' },
        });
        if (business) {
          business_id = business.id;
        }
      }
      
      // If not found as owner, check if user is a member of a business
      if (!business_id) {
        const membership = await this.businessMembersRepository.findOne({
          where: { 
            user_id: user.id,
            is_active: true,
          },
          order: { joined_at: 'ASC' },
        });
        
        if (membership) {
          business_id = membership.business_id;
        }
      }
    } catch (error: any) {
      console.warn('Could not resolve business_id for JWT payload:', error?.message);
    }

    // ── Construire le payload JWT ─────────────────────────────────────
    const payload = {
      sub:         user.id,
      email:       user.email,
      role:        user.role,
      business_id: business_id,  // null pour PLATFORM_ADMIN
    };

    const access_token = this.jwtService.sign(payload, {
      secret:    this.configService.get<string>('JWT_ACCESS_SECRET')!,
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY') as any,
    });

    // ── Refresh token (stocké en DB) ──────────────────────────────────
    const refresh_token = uuidv4();
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7); // 7 jours

    await this.refreshTokenRepo.save({
      token:   refresh_token,
      user_id: user.id,
      expires_at,
    });

    return { access_token, refresh_token };
  }

  // ─── Generate Tokens and Set HTTP-only Cookies ───────────────────────────
  private async generateTokensAndSetCookies(user: User, res: Response): Promise<void> {
    const { access_token, refresh_token } = await this.generateTokens(user);
    
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    
    // Set access_token cookie (15 minutes)
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Allow cross-site cookies for different domains
      maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    });
    
    // Set refresh_token cookie (7 days)
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'none', // Allow cross-site cookies for different domains
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
  }

  // ─── Update Profile ──────────────────────────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.usersService.findByEmail(dto.email);
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
      user.email = dto.email;
      user.is_verified = false; // New email needs verification
    }

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName;
    }

    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 12);
    }

    if (dto.messageColor !== undefined) {
      user.messageColor = dto.messageColor;
    }

    return this.usersService.updateUser(userId, user);
  }

  // ─── Verify Email ────────────────────────────────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const tokenRecord = await this.resetTokenRepo.findOne({
      where: { token, type: TokenType.EMAIL_VERIFICATION },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.is_used || tokenRecord.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.verify(tokenRecord.user.id);
    await this.resetTokenRepo.update(tokenRecord.id, { is_used: true });

    // ✅ NEW: Send welcome email
    const fullName = `${tokenRecord.user.firstName} ${tokenRecord.user.lastName}`;
    await this.emailService.sendWelcomeEmail(tokenRecord.user.email, fullName);
  }
  // ─── Forgot Password ─────────────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return; // Silently succeed (don't reveal if email exists)
    }

    const token = uuidv4();
    const expires_at = new Date();
    expires_at.setHours(expires_at.getHours() + 1); // 1 hour

    await this.resetTokenRepo.save({
      token,
      user_id: user.id,
      type: TokenType.PASSWORD_RESET,
      expires_at,
    });

    // ✅ NEW: Send actual email instead of console.log
    const fullName = `${user.firstName} ${user.lastName}`;
    await this.emailService.sendPasswordResetEmail(user.email, token, fullName);
  }
  // ─── Reset Password ──────────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenRecord = await this.resetTokenRepo.findOne({
      where: { token, type: TokenType.PASSWORD_RESET },
      relations: ['user'],
    });

    if (!tokenRecord || tokenRecord.is_used || tokenRecord.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await this.usersService.updateUser(tokenRecord.user.id, {
      ...tokenRecord.user,
      password_hash,
    });

    await this.resetTokenRepo.update(tokenRecord.id, { is_used: true });
  }

  // ─── OAuth Login Handler ─────────────────────────────────────────────────
  async handleOAuthLogin(oauthUser: any, res: Response): Promise<{ message: string; user: any }> {
    // Find or create user based on OAuth profile
    let user = await this.usersService.findByEmail(oauthUser.email);

    if (!user) {
      // Create new user from OAuth profile
      const hashedPassword = await bcrypt.hash(uuidv4(), 10); // Random password for OAuth users
      
      user = this.usersRepository.create({
        email: oauthUser.email,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName,
        password_hash: hashedPassword,
        role: Role.BUSINESS_OWNER, // Default role for new OAuth users
        is_verified: true, // OAuth emails are pre-verified
      });

      user = await this.usersRepository.save(user);

      // Create a basic tenant for the new user
      const tenantData: Partial<Tenant> = {
        ownerId: user.id,
        name: `${user.firstName}'s Company`,
        contactEmail: user.email,
        billingPlan: 'free',
        status: TenantStatus.ACTIVE,
      };
      const tenant = this.tenantsRepository.create(tenantData);
      await this.tenantsRepository.save(tenant);

      // Create a default business
      const business = this.businessesRepository.create({
        name: `${user.firstName}'s Business`,
        tenant_id: tenant.id,
        email: user.email,
        currency: 'TND',
      });
      await this.businessesRepository.save(business);

      // Add default tax rates
      const defaultTaxRates = [
        { business_id: business.id, name: 'TVA 19%', rate: 19, is_default: true },
        { business_id: business.id, name: 'TVA 7%', rate: 7, is_default: false },
        { business_id: business.id, name: 'TVA 13%', rate: 13, is_default: false },
      ];
      await this.taxRatesRepository.save(defaultTaxRates);

      // Create business member
      const member = this.businessMembersRepository.create({
        business_id: business.id,
        user_id: user.id,
        role: Role.BUSINESS_OWNER,
        is_active: true,
        joined_at: new Date(),
        collaboration_permissions: {},
        stock_permissions: {},
        payment_permissions: {},
        salary_permissions: {},
        sales_permissions: {},
        purchase_permissions: {},
      });
      await this.businessMembersRepository.save(member);
    }

    // Check if user is suspended
    if (user.is_suspended) {
      throw new UnauthorizedException('Your account has been suspended. Please contact support for assistance.');
    }

    // Generate tokens and set cookies
    await this.generateTokensAndSetCookies(user, res);

    return {
      message: 'OAuth login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}