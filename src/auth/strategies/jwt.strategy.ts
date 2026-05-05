// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../users/users.service';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Subscription } from '../../platform-admin/entities/subscription.entity';
import { SubscriptionStatus } from '../../platform-admin/enums/subscription-status.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(BusinessMember)
    private readonly businessMemberRepository: Repository<BusinessMember>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First, try to extract from cookie
        (request: Request) => {
          return request?.cookies?.access_token;
        },
        // Fallback to Authorization header for API clients
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      // The ! at the end tells TypeScript "I guarantee this is not undefined"
      // It will crash at runtime if JWT_ACCESS_SECRET is missing from .env,
      // which is exactly what you want — fail loud, fail early.
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

async validate(payload: { sub: string; email: string; role: string; business_id: string | null }): Promise<any> {
  // Fetch user to verify they still exist
  const user = await this.usersService.findById(payload.sub);
  if (!user) {
    return null;
  }
  
  // Check if user is suspended at the user level (tenant suspension by admin)
  if (user.is_suspended) {
    throw new UnauthorizedException('Your account has been suspended. Please contact support for assistance.');
  }
  
  // Check subscription status for expired free trials
  // Find the tenant for this user
  const tenant = await this.tenantRepository.findOne({
    where: { ownerId: user.id },
  });
  
  if (tenant) {
    // Check if tenant has an expired subscription
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenant_id: tenant.id },
      relations: ['plan'],
      order: { created_at: 'DESC' },
    });
    
    if (subscription && subscription.status === SubscriptionStatus.EXPIRED) {
      throw new UnauthorizedException('Your free trial has expired. Please upgrade your plan.');
    }
  }
  
  // If user has a business_id in JWT, check if they're an active business member
  // This check is for subscription-related blocks (not tenant suspension)
  if (payload.business_id) {
    const membership = await this.businessMemberRepository.findOne({
      where: {
        business_id: payload.business_id,
        user_id: user.id,
      },
    });
    
    // If membership exists but is_active is false, this is a subscription issue
    // (not a tenant suspension, because user.is_suspended would be true for that)
    if (membership && !membership.is_active) {
      throw new UnauthorizedException('Your subscription has been suspended or cancelled. Please contact support for assistance.');
    }
  }
  
  // Return user object with business_id from JWT payload
  // This ensures business_id is always available even though it's not in the User entity
  const userWithBusinessId = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    is_verified: user.is_verified,
    is_suspended: user.is_suspended,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone,
    messageColor: user.messageColor,
    created_at: user.created_at,
    updated_at: user.updated_at,
    business_id: payload.business_id, // From JWT payload, not DB
  };
  
  return userWithBusinessId;
}
}