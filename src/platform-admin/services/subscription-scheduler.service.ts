// src/platform-admin/services/subscription-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionManagementService } from './subscription-management.service';
import { EmailService } from '../../email/email.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    private readonly subscriptionService: SubscriptionManagementService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Trial Expiry Warning (Daily at 8 AM) ───────────────────────────────
  @Cron('0 8 * * *', {
    name: 'trial-expiry-warning',
    timeZone: 'Africa/Tunis',
  })
  async handleTrialExpiryWarning() {
    this.logger.log('Running trial expiry warning job...');

    try {
      const expiringSubscriptions = await this.subscriptionService.getTrialExpiringSubscriptions();

      for (const subscription of expiringSubscriptions) {
        const tenant = subscription.tenant;
        const owner = tenant.owner;
        const fullName = `${owner.firstName} ${owner.lastName}`;

        // Send trial expiry warning email
        await this.emailService.sendTrialExpiryWarning(
          owner.email,
          fullName,
          subscription.trial_ends_at!
        );

        this.logger.log(`Trial expiry warning sent to ${owner.email}`);
      }

      this.logger.log(`Processed ${expiringSubscriptions.length} trial expiry warnings`);
    } catch (error) {
      this.logger.error('Error in trial expiry warning job:', error);
    }
  }

  // ─── Mark Overdue Subscriptions (Daily at 9 AM) ─────────────────────────
  @Cron('0 9 * * *', {
    name: 'mark-overdue-subscriptions',
    timeZone: 'Africa/Tunis',
  })
  async handleOverdueSubscriptions() {
    this.logger.log('Running overdue subscriptions job...');

    try {
      const expiredSubscriptions = await this.subscriptionService.getExpiredActiveSubscriptions();

      for (const subscription of expiredSubscriptions) {
        // Mark as overdue
        await this.subscriptionService.updateSubscriptionStatus(
          subscription.id,
          SubscriptionStatus.OVERDUE
        );

        const tenant = subscription.tenant;
        const owner = tenant.owner;
        const fullName = `${owner.firstName} ${owner.lastName}`;

        // Send payment reminder email
        await this.emailService.sendPaymentReminder(
          owner.email,
          fullName,
          subscription.current_period_end
        );

        this.logger.log(`Marked subscription ${subscription.id} as overdue and sent reminder to ${owner.email}`);
      }

      this.logger.log(`Processed ${expiredSubscriptions.length} overdue subscriptions`);
    } catch (error) {
      this.logger.error('Error in overdue subscriptions job:', error);
    }
  }

  // ─── Data Deletion Warning (Daily at 10 AM) ─────────────────────────────
  @Cron('0 10 * * *', {
    name: 'data-deletion-warning',
    timeZone: 'Africa/Tunis',
  })
  async handleDataDeletionWarning() {
    this.logger.log('Running data deletion warning job...');

    try {
      const longSuspendedSubscriptions = await this.subscriptionService.getLongSuspendedSubscriptions();

      for (const subscription of longSuspendedSubscriptions) {
        const tenant = subscription.tenant;
        const owner = tenant.owner;
        const fullName = `${owner.firstName} ${owner.lastName}`;

        // Send final data deletion warning
        await this.emailService.sendDataDeletionWarning(
          owner.email,
          fullName,
          subscription.suspended_at!
        );

        this.logger.log(`Data deletion warning sent to ${owner.email}`);
      }

      this.logger.log(`Processed ${longSuspendedSubscriptions.length} data deletion warnings`);
    } catch (error) {
      this.logger.error('Error in data deletion warning job:', error);
    }
  }
}