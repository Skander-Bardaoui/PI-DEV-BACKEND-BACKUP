// src/platform-admin/services/subscription-expiry.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
// Import email service if it exists
// import { EmailService } from '../../email/email.service';

@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    // private readonly emailService: EmailService, // Uncomment when email service is available
  ) {}

  // Run every day at 6:00 AM
  @Cron('0 6 * * *', {
    name: 'expire-free-trials',
    timeZone: 'Africa/Tunis',
  })
  async expireFreeTrial() {
    this.logger.log('Running free trial expiry job...');

    try {
      // Find active subscriptions with free plan that have expired
      const expiredSubscriptions = await this.subscriptionRepo
        .createQueryBuilder('subscription')
        .leftJoinAndSelect('subscription.plan', 'plan')
        .leftJoinAndSelect('subscription.tenant', 'tenant')
        .where('plan.slug = :slug', { slug: 'free' })
        .andWhere('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('subscription.current_period_end < :now', { now: new Date() })
        .getMany();

      this.logger.log(`Found ${expiredSubscriptions.length} expired free trials`);

      for (const subscription of expiredSubscriptions) {
        try {
          // Update subscription status to expired
          subscription.status = SubscriptionStatus.EXPIRED;
          await this.subscriptionRepo.save(subscription);

          this.logger.log(`Expired subscription ${subscription.id} for tenant ${subscription.tenant_id}`);

          // Send expiry email to tenant owner
          await this.sendExpiryEmail(subscription);
        } catch (error) {
          this.logger.error(`Error expiring subscription ${subscription.id}:`, error);
        }
      }

      this.logger.log('Free trial expiry job completed');
    } catch (error) {
      this.logger.error('Error in free trial expiry job:', error);
    }
  }

  private async sendExpiryEmail(subscription: Subscription) {
    try {
      // Get tenant owner
      const tenant = await this.tenantRepo.findOne({
        where: { id: subscription.tenant_id },
      });

      if (!tenant || !tenant.ownerId) {
        this.logger.warn(`No owner found for tenant ${subscription.tenant_id}`);
        return;
      }

      const owner = await this.userRepo.findOne({
        where: { id: tenant.ownerId },
      });

      if (!owner || !owner.email) {
        this.logger.warn(`No email found for owner ${tenant.ownerId}`);
        return;
      }

      // TODO: Send email using your email service
      // await this.emailService.sendTrialExpiryEmail({
      //   to: owner.email,
      //   ownerName: owner.firstName || owner.email,
      //   tenantName: tenant.name,
      // });

      this.logger.log(`Expiry email sent to ${owner.email}`);
    } catch (error) {
      this.logger.error(`Error sending expiry email for subscription ${subscription.id}:`, error);
    }
  }
}
