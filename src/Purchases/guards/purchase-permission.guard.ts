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

export const PURCHASE_PERMISSION_KEY = 'purchasePermission';

@Injectable()
export class PurchasePermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(BusinessMember)
    private businessMemberRepo: Repository<BusinessMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      PURCHASE_PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const businessId = request.params.businessId;

    console.log('🔍 PurchasePermissionGuard - Debug:', {
      requiredPermission,
      userId: user?.id,
      userRole: user?.role,
      businessId,
      hasUser: !!user,
      hasBusinessId: !!businessId,
    });

    if (!user || !businessId) {
      console.error('❌ User or business not found');
      throw new ForbiddenException('User or business not found');
    }

    // BUSINESS_OWNER and PLATFORM_ADMIN bypass all checks
    if (user.role === Role.BUSINESS_OWNER || user.role === Role.PLATFORM_ADMIN) {
      console.log('✅ Bypassing permission check for BUSINESS_OWNER/PLATFORM_ADMIN');
      return true;
    }

    try {
      // Find member in business
      const member = await this.businessMemberRepo.findOne({
        where: {
          business_id: businessId,
          user_id: user.id,
          is_active: true,
        },
      });

      console.log('🔍 Member found:', {
        memberId: member?.id,
        memberRole: member?.role,
        hasPurchasePermissions: !!member?.purchase_permissions,
        purchasePermissions: member?.purchase_permissions,
      });

      if (!member) {
        console.error('❌ Not a member of this business');
        throw new ForbiddenException('Not a member of this business');
      }

      // Check specific permission (default to false if key is missing)
      // If purchase_permissions is null or undefined, default to empty object
      const permissions = member.purchase_permissions || {};
      const hasPermission = permissions[requiredPermission] === true;

      console.log('🔍 Permission check result:', {
        requiredPermission,
        hasPermission,
        allPermissions: permissions,
      });

      if (!hasPermission) {
        console.log('❌ Permission denied:', {
          userId: user.id,
          businessId,
          requiredPermission,
          userPermissions: permissions,
          memberRole: member.role,
        });
        throw new ForbiddenException(
          `Missing required permission: ${requiredPermission}`,
        );
      }

      console.log('✅ Permission granted');
      return true;
    } catch (error) {
      console.error('❌ PurchasePermissionGuard error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // Log the actual error before throwing generic message
      console.error('Unexpected error type:', typeof error, error);
      throw new ForbiddenException('Permission check failed');
    }
  }
}
