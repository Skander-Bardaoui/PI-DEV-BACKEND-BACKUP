// src/platform-auth/platform-auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Auth
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAdmin } from './entities/platform-admin.entity';
import { PlatformRefreshToken } from './entities/platform-refresh-token.entity';
import { PlatformLoginAttempt } from './entities/platform-login-attempt.entity';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

// Tenant Management
import { TenantManagementController } from '../platform-admin/controllers/tenant-management.controller';
import { TenantManagementService } from '../platform-admin/services/tenant-management.service';
import { TenantApproval } from '../platform-admin/entities/tenant-approval.entity';
import { ImpersonationLog } from '../platform-admin/entities/impersonation-log.entity';
import { TenantExportToken } from '../platform-admin/entities/tenant-export-token.entity';

// Subscription Payment (Public)
import { SubscriptionPaymentController } from '../platform-admin/controllers/subscription-payment.controller';
import { SubscriptionPaymentService } from '../platform-admin/services/subscription-payment.service';
import { StripeWebhookController } from '../platform-admin/controllers/stripe-webhook.controller';

// Subscription Management
import { SubscriptionManagementController } from '../platform-admin/controllers/subscription-management.controller';
import { SubscriptionManagementService } from '../platform-admin/services/subscription-management.service';
import { Subscription } from '../platform-admin/entities/subscription.entity';

// Payment Management
import { PaymentManagementController } from '../platform-admin/controllers/payment-management.controller';
import { PaymentManagementService } from '../platform-admin/services/payment-management.service';
import { Payment } from '../platform-admin/entities/payment.entity';

// Public Controllers (No Auth)
import { PublicPlansController } from '../platform-admin/controllers/public-plans.controller';
import { PublicPaymentController } from '../platform-admin/controllers/public-payment.controller';

// Plan Management
import { PlanManagementController } from '../platform-admin/controllers/plan-management.controller';
import { PlanManagementService } from '../platform-admin/services/plan-management.service';
import { PlanSeedService } from '../platform-admin/services/plan-seed.service';
import { Plan } from '../platform-admin/entities/plan.entity';

// Subscription Expiry
import { SubscriptionExpiryService } from '../platform-admin/services/subscription-expiry.service';

// Dashboard & Analytics
import { DashboardController } from '../platform-admin/controllers/dashboard.controller';
import { DashboardService } from '../platform-admin/services/dashboard.service';

// AI Pricing
import { AiPricingController } from '../platform-admin/controllers/ai-pricing.controller';
import { AiPricingService } from '../platform-admin/services/ai-pricing.service';

// Audit Log
import { AuditLogController } from '../platform-admin/controllers/audit-log.controller';
import { AuditLogService } from '../platform-admin/services/audit-log.service';
import { PlatformAuditLog } from '../platform-admin/entities/platform-audit-log.entity';

// System Health
import { SystemHealthController } from '../platform-admin/controllers/system-health.controller';
import { SystemHealthService } from '../platform-admin/services/system-health.service';

// Support Tickets
import { SupportTicketController } from '../platform-admin/controllers/support-ticket.controller';
import { SupportTicketService } from '../platform-admin/services/support-ticket.service';
import { SupportTicket } from '../platform-admin/entities/support-ticket.entity';

// Scheduled Jobs
import { SubscriptionSchedulerService } from '../platform-admin/services/subscription-scheduler.service';

// Seeder Service
import { PlatformSeederService } from './services/platform-seeder.service';

// Registration Service
import { TenantRegistrationService } from '../platform-admin/services/tenant-registration.service';

// External Dependencies
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Platform Auth
      PlatformAdmin,
      PlatformRefreshToken,
      PlatformLoginAttempt,
      
      // Tenant Management
      TenantApproval,
      ImpersonationLog,
      TenantExportToken,
      Subscription,
      Plan,
      Payment,
      
      // Analytics & Audit
      PlatformAuditLog,
      SupportTicket,
      
      // External Entities
      Tenant,
      User,
      Business,
      BusinessMember,
    ]),
    PassportModule,
    JwtModule.register({}), // Configuration done in service
    ConfigModule,
    ScheduleModule.forRoot(),
    EmailModule,
  ],
  controllers: [
    PlatformAuthController,
    TenantManagementController,
    SubscriptionManagementController,
    PaymentManagementController,
    PlanManagementController,
    DashboardController,
    AiPricingController,
    AuditLogController,
    SystemHealthController,
    SupportTicketController,
    PublicPlansController,
    PublicPaymentController,
    SubscriptionPaymentController,
    StripeWebhookController,
  ],
  providers: [
    PlatformAuthService,
    PlatformJwtStrategy,
    TenantManagementService,
    SubscriptionManagementService,
    PaymentManagementService,
    PlanManagementService,
    PlanSeedService,
    SubscriptionExpiryService,
    SubscriptionSchedulerService,
    TenantRegistrationService,
    DashboardService,
    AiPricingService,
    AuditLogService,
    SystemHealthService,
    SupportTicketService,
    PlatformSeederService, // Add seeder service
    SubscriptionPaymentService,
  ],
  exports: [
    PlatformAuthService,
    TenantRegistrationService,
    AuditLogService,
    TypeOrmModule, // Export TypeOrmModule so other modules can use Subscription entity for AiFeatureGuard
  ],
})
export class PlatformAuthModule {}
