// src/app.module.ts
import { Controller, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Core Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { BusinessesModule } from './businesses/businesses.module';

// Sales & Finance Modules
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';

// Stock Module
import { StockModule } from './stock/stock.module';

// Tasks Module
import { TasksModule } from './tasks/tasks.module';

// Collaboration Module
import { CollaborationModule } from './collaboration/collaboration.module';

// Subtasks Module
import { SubtasksModule } from './subtasks/subtasks.module';

// Messages Module
import { MessagesModule } from './messages/messages.module';

// Activities Module
import { ActivitiesModule } from './activities/activities.module';

// Statistics Module
import { StatisticsModule } from './statistics/statistics.module';

// Presence Module
import { PresenceModule } from './presence/presence.module';
// Common Module
import { CommonModule } from './common/common.module';

// Platform Auth Module
import { PlatformAuthModule } from './platform-auth/platform-auth.module';

// Support Module
import { SupportModule } from './support/support.module';

// Core Entities
import { User } from './users/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
import { Tenant } from './tenants/entities/tenant.entity';
import { Business } from './businesses/entities/business.entity';
import { BusinessSettings } from './businesses/entities/business-settings.entity';
import { TaxRate } from './businesses/entities/tax-rate.entity';
import { Client } from './sales/entities/client.entity';
import { Quote } from './sales/entities/quote.entity';
import { QuoteItem } from './sales/entities/quote-item.entity';
import { SalesOrder } from './sales/entities/sales-order.entity';
import { SalesOrderItem } from './sales/entities/sales-order-item.entity';
import { DeliveryNote } from './sales/entities/delivery-note.entity';
import { DeliveryNoteItem } from './sales/entities/delivery-note-item.entity';
import { StockExit } from './sales/entities/stock-exit.entity';
import { StockExitItem } from './sales/entities/stock-exit-item.entity';
import { Invoice } from './sales/entities/invoice.entity';
import { InvoiceItem } from './sales/entities/invoice-item.entity';

// Finance Entities
import { Account } from './payments/entities/account.entity';
import { Payment } from './payments/entities/payment.entity';

// Stock Entities
import { Product } from './stock/entities/product.entity';
import { ProductCategory } from './stock/entities/product-category.entity';
import { StockMovement } from './stock/entities/stock-movement.entity';
import { Warehouse } from './stock/entities/warehouse.entity';

// Tasks Entities
import { Task } from './tasks/entities/task.entity';

// Collaboration Entities
import { DailyCheckin } from './collaboration/entities/daily-checkin.entity';
import { Comment } from './collaboration/entities/comment.entity';
import { ActivityLog } from './collaboration/entities/activity-log.entity';
import { Task as CollaborationTask } from './collaboration/entities/task.entity';

// Subtasks Entities
import { Subtask } from './subtasks/entities/subtask.entity';

// Messages Entities
import { Message } from './messages/entities/message.entity';
import { ChatColorPreference } from './messages/entities/chat-color-preference.entity';

// Activities Entities
import { Activity } from './activities/entities/activity.entity';

// Common Entities
import { AuditLog } from './common/entities/audit-log.entity';

// Platform Auth Entities
import { PlatformAdmin } from './platform-auth/entities/platform-admin.entity';
import { PlatformRefreshToken } from './platform-auth/entities/platform-refresh-token.entity';
import { PlatformLoginAttempt } from './platform-auth/entities/platform-login-attempt.entity';
import { TenantApproval } from './platform-admin/entities/tenant-approval.entity';
import { Subscription } from './platform-admin/entities/subscription.entity';
import { Plan } from './platform-admin/entities/plan.entity';
import { ImpersonationLog } from './platform-admin/entities/impersonation-log.entity';
import { PlatformAuditLog } from './platform-admin/entities/platform-audit-log.entity';
import { SupportTicket } from './platform-admin/entities/support-ticket.entity';
import { Payment as SubscriptionPayment } from './platform-admin/entities/payment.entity';

// Purchases Entities
import { Supplier } from './Purchases/entities/supplier.entity';
import { SupplierPO } from './Purchases/entities/supplier-po.entity';
import { SupplierPOItem } from './Purchases/entities/supplier-po-item.entity';
import { PurchaseInvoice } from './Purchases/entities/purchase-invoice.entity';
import { GoodsReceipt } from './Purchases/entities/goods-receipt.entity';
import { GoodsReceiptItem } from './Purchases/entities/goods-receipt-item.entity';
import { PurchasesModule } from './Purchases/purchases.module';
import { SupplierPOsController } from './Purchases/controllers/supplier-pos.controller';
import { SuppliersController } from './Purchases/controllers/suppliers.controller';
import { SupplierPortalToken } from './Purchases/entities/supplier-portal-token.entity';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 🔐 Security: Rate Limiting (HTTP only, skips WebSocket)
    ThrottlerModule.forRoot([{
      ttl: 60000,  // Time window: 60 seconds
      limit: 100,  // Max 100 requests per window
      skipIf: (context) => {
        // Skip throttling for WebSocket connections
        const request = context.switchToHttp().getRequest();
        return !request || request.url === undefined;
      },
    }]),

   TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: +(configService.get<number>('DB_PORT') ?? 5432),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_NAME'),
    ssl: configService.get('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
      : false,
    synchronize: true,
    autoLoadEntities: true,
        entities: [
          // Core
          User,
          RefreshToken,
          PasswordResetToken,
          Tenant,
          Business,
          BusinessSettings,
          TaxRate,
          Client,

          // Purchases
          Supplier,
          SupplierPO,
          SupplierPOItem,
          PurchaseInvoice,
          GoodsReceipt,
          GoodsReceiptItem,
          // SupplierPortalToken, // Temporairement retiré pour éviter les erreurs de synchronisation
          // Sales
          Quote,
          QuoteItem,
          SalesOrder,
          SalesOrderItem,
          DeliveryNote,
          DeliveryNoteItem,
          StockExit,
          StockExitItem,
          Invoice,
          InvoiceItem,
          // Finance
          Account,
          Payment,


          // Stock
          Product,
          ProductCategory,
          StockMovement,
          Warehouse,

          // Tasks
          Task,

          // Collaboration
          DailyCheckin,
          Comment,
          ActivityLog,
          CollaborationTask,

          // Subtasks
          Subtask,

          // Messages
          Message,
          ChatColorPreference,

          // Activities
          Activity,

          // Common
          AuditLog,

          // Platform Auth
          PlatformAdmin,
          PlatformRefreshToken,
          PlatformLoginAttempt,
          TenantApproval,
          Subscription,
          Plan,
          ImpersonationLog,
          PlatformAuditLog,
          SupportTicket,
          SubscriptionPayment,
        ],
      }),
      inject: [ConfigService],
    }),

    // Common Module
    CommonModule,

    // Core Modules
    UsersModule,
    AuthModule,
    TenantsModule,
    BusinessesModule,

    // Sales & Finance
    SalesModule,
    PaymentsModule,


    // Purchases
    PurchasesModule,

    // Stock
    StockModule,

    // Tasks
    TasksModule,

    // Collaboration
    CollaborationModule,

    // Subtasks
    SubtasksModule,

    // Messages
    MessagesModule,

    // Activities
    ActivitiesModule,

    // Statistics
    StatisticsModule,

    // Presence
    PresenceModule,

    // Platform Auth
    PlatformAuthModule,

    // Support
    SupportModule,
  ],
  controllers: [],
  providers: [
    // 🔐 Security: Global rate limiting guard (skips WebSocket connections)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
