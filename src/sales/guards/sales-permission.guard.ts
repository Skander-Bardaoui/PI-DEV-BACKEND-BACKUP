import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { Role } from '../../users/enums/role.enum';

export const SALES_PERMISSION_KEY = 'salesPermission';

@Injectable()
export class SalesPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(BusinessMember)
    private businessMemberRepo: Repository<BusinessMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      SALES_PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const businessId = request.params.businessId;

    if (!user || !businessId) {
      throw new ForbiddenException('User or business not found');
    }

    // BUSINESS_OWNER bypasses all checks
    if (user.role === Role.BUSINESS_OWNER) {
      return true;
    }

    // Find member in business
    const member = await this.businessMemberRepo.findOne({
      where: {
        business_id: businessId,
        user_id: user.id,
        is_active: true,
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this business');
    }

    // Check specific permission (default to false if key is missing)
    const hasPermission = member.sales_permissions?.[requiredPermission] === true;

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing required permission: ${requiredPermission}`,
      );
    }

    return true;
  }
}
