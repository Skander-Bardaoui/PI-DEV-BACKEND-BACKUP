// src/businesses/guards/business-access.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../users/enums/role.enum';
import { Business } from '../entities/business.entity';
import { BusinessMember } from '../entities/business-member.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export const BUSINESS_ACCESS_KEY = 'businessAccess';

export interface BusinessAccessConfig {
  allowOwner?: boolean; // Tenant owner
  allowAdmin?: boolean; // Business admin
  allowMember?: boolean; // Team member
  allowAccountant?: boolean; // Accountant
  requireBusinessParam?: boolean; // If true, expects :id param in route
}

@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(BusinessMember)
    private businessMemberRepository: Repository<BusinessMember>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<BusinessAccessConfig>(
      BUSINESS_ACCESS_KEY,
      context.getHandler(),
    );

    // If no config, allow access (handled by other guards)
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // PLATFORM_ADMIN has access to everything
    if (user.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    // Get business ID from route params or query
    const businessId = request.params.id || request.params.businessId || request.query.business_id;

    console.log('BusinessAccessGuard:', {
      url: request.url,
      method: request.method,
      params: request.params,
      businessId,
      userId: user.id,
      userRole: user.role,
      config,
    });

    if (config.requireBusinessParam && !businessId) {
      throw new ForbiddenException('Business ID required');
    }

    // Check if user is the tenant owner
    if (config.allowOwner && user.role === Role.BUSINESS_OWNER) {
      if (businessId) {
        // Verify the business belongs to user's tenant
        const business = await this.businessRepository.findOne({
          where: { id: businessId },
        });

        if (!business) {
          throw new NotFoundException('Business not found');
        }

        const tenant = await this.tenantRepository.findOne({
          where: { ownerId: user.id },
        });

        if (tenant && business.tenant_id === tenant.id) {
          console.log('BusinessAccessGuard: Access granted (tenant owner)');
          return true;
        }
      } else {
        // No specific business, allow if they're a tenant owner
        const tenant = await this.tenantRepository.findOne({
          where: { ownerId: user.id },
        });
        return !!tenant;
      }
    }

    // Check if user is a member of the specific business
    if (businessId) {
      const membership = await this.businessMemberRepository.findOne({
        where: {
          business_id: businessId,
          user_id: user.id,
          is_active: true,
        },
      });

      console.log('BusinessAccessGuard: Membership check:', {
        found: !!membership,
        membershipRole: membership?.role,
      });

      if (membership) {
        // Check role-specific permissions
        if (
          (config.allowAdmin && membership.role === Role.BUSINESS_ADMIN) ||
          (config.allowMember && membership.role === Role.TEAM_MEMBER) ||
          (config.allowAccountant && membership.role === Role.ACCOUNTANT)
        ) {
          console.log('BusinessAccessGuard: Access granted (member with role)');
          return true;
        }
      }
    }

    console.log('BusinessAccessGuard: Access denied');
    throw new ForbiddenException('You do not have access to this business');
  }
}
