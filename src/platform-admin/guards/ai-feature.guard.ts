// src/platform-admin/guards/ai-feature.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Business } from '../../businesses/entities/business.entity';

@Injectable()
export class AiFeatureGuard implements CanActivate {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Find tenant_id: first try by ownerId, then by business_id
    let tenantId: string | null = null;
    
    // Try to find tenant by owner
    const tenantByOwner = await this.tenantRepo.findOne({
      where: { ownerId: user.id },
    });
    
    if (tenantByOwner) {
      tenantId = tenantByOwner.id;
    } else if (user.business_id) {
      // Find tenant through business
      const business = await this.businessRepo.findOne({
        where: { id: user.business_id },
        relations: ['tenant'],
      });
      
      if (business && business.tenant) {
        tenantId = business.tenant.id;
      }
    }

    if (!tenantId) {
      throw new ForbiddenException({
        error: 'AI_NOT_AVAILABLE',
        message: 'Les fonctionnalités IA ne sont pas disponibles dans votre plan actuel. Passez au plan Premium pour y accéder.',
        upgradeRequired: true,
      });
    }

    // Query active subscription with plan
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        tenant_id: tenantId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan'],
    });

    if (!subscription || !subscription.plan) {
      throw new ForbiddenException({
        error: 'AI_NOT_AVAILABLE',
        message: 'Les fonctionnalités IA ne sont pas disponibles dans votre plan actuel. Passez au plan Premium pour y accéder.',
        upgradeRequired: true,
      });
    }

    // Check if AI is enabled for this plan
    if (!subscription.plan.ai_enabled) {
      throw new ForbiddenException({
        error: 'AI_NOT_AVAILABLE',
        message: 'Les fonctionnalités IA ne sont pas disponibles dans votre plan actuel. Passez au plan Premium pour y accéder.',
        upgradeRequired: true,
      });
    }

    // AI is enabled, allow through
    return true;
  }
}
