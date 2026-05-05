import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { DeliveryNote } from './entities/delivery-note.entity';
import { DeliveryNoteItem } from './entities/delivery-note-item.entity';
import { StockExit } from './entities/stock-exit.entity';
import { StockExitItem } from './entities/stock-exit-item.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { RecurringInvoice } from './entities/recurring-invoice.entity';
import { ClientPortalToken } from './entities/client-portal-token.entity';
import { QuotePortalToken } from './entities/quote-portal-token.entity';
import { RecurringSubscriptionToken } from './entities/recurring-subscription-token.entity';
import { QuotesService } from './services/quotes.service';
import { SalesOrdersService } from './services/sales-orders.service';
import { DeliveryNotesService } from './services/delivery-notes.service';
import { InvoicesService } from './services/invoices.service';
import { SalesMailService } from './services/sales-mail.service';
import { SalesOcrService } from './services/sales-ocr.service';
import { SalesOcrAiService } from './services/sales-ocr-ai.service';
import { SalesDashboardAiService } from './services/sales-dashboard-ai.service';
import { SalesEmailAiService } from './services/sales-email-ai.service';
import { InvoiceCronService } from './services/invoice-cron.service';
import { RecurringInvoicesService } from './services/recurring-invoices.service';
import { RecurringInvoiceCronService } from './services/recurring-invoice-cron.service';
// import { RecurringSubscriptionMailService } from './services/recurring-subscription-mail.service';
// import { SubscriptionManageService } from './services/subscription-manage.service';
import { ClientPortalService } from './services/client-portal.service';
import { QuotePortalService } from './services/quote-portal.service';
import { SalesDashboardService } from './services/sales-dashboard.service';
import { SalesMatchingService } from './services/sales-matching.service';
import { ClientOnboardingService } from './services/client-onboarding.service';
import { ClientsService } from './services/clients.service';
import { SalesMLService } from './services/sales-ml.service';
import { QuotesController } from './controllers/quotes.controller';
import { SalesOrdersController } from './controllers/sales-orders.controller';
import { DeliveryNotesController } from './controllers/delivery-notes.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { SalesOcrController } from './controllers/sales-ocr.controller';
import { RecurringInvoicesController } from './controllers/recurring-invoices.controller';
import { ClientPortalController } from './controllers/client-portal.controller';
// import { SubscriptionManageController } from './controllers/subscription-manage.controller';
import { QuotePortalController } from './controllers/quote-portal.controller';
import { SalesDashboardController } from './controllers/sales-dashboard.controller';
import { SalesMatchingController } from './controllers/sales-matching.controller';
import { SalesClientsController } from './controllers/clients.controller';
import { SalesMLController } from './controllers/sales-ml.controller';
import {
  ClientOnboardingController,
  ClientOnboardingPublicController,
} from './controllers/client-onboarding.controller';
import { Client } from './entities/client.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { StockModule } from '../stock/stock.module';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Product } from '../stock/entities/product.entity';
import { SalesPermissionGuard } from './guards/sales-permission.guard';
import { Subscription } from '../platform-admin/entities/subscription.entity';
import { AiFeatureGuard } from '../platform-admin/guards/ai-feature.guard';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    BusinessesModule, // Import BusinessesModule to get BusinessAccessGuard dependencies
    StockModule, // Import StockModule to get StockMovementsService
    JwtModule.register({
      secret: process.env.JWT_CLIENT_ONBOARDING_SECRET || 'client_onboarding_secret_change_me',
      signOptions: { expiresIn: '7d' },
    }),
    TypeOrmModule.forFeature([
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
      RecurringInvoice,
      ClientPortalToken,
      QuotePortalToken,
      RecurringSubscriptionToken,
      Client,
      Business,
      BusinessMember,
      Tenant,
      StockMovement,
      Product,
      Subscription,
    ]),
  ],
  providers: [
    QuotesService,
    SalesOrdersService,
    DeliveryNotesService,
    InvoicesService,
    SalesMailService,
    SalesOcrService,
    SalesOcrAiService,
    SalesDashboardAiService,
    SalesEmailAiService,
    InvoiceCronService,
    RecurringInvoicesService,
    RecurringInvoiceCronService,
    // RecurringSubscriptionMailService,
    // SubscriptionManageService,
    ClientPortalService,
    QuotePortalService,
    SalesDashboardService,
    SalesMatchingService,
    ClientsService,
    ClientOnboardingService,
    SalesMLService,
    SalesPermissionGuard,
    AiFeatureGuard,
  ],
  controllers: [
    QuotesController,
    SalesOrdersController,
    DeliveryNotesController,
    InvoicesController,
    SalesOcrController,
    RecurringInvoicesController,
    ClientPortalController,
    // SubscriptionManageController,
    QuotePortalController,
    SalesDashboardController,
    SalesMatchingController,
    SalesClientsController,
    SalesMLController,
    ClientOnboardingController,
    ClientOnboardingPublicController,
  ],
  exports: [
    QuotesService,
    SalesOrdersService,
    DeliveryNotesService,
    InvoicesService,
    SalesMailService,
    SalesOcrService,
    SalesOcrAiService,
    SalesDashboardAiService,
    RecurringInvoicesService,
    ClientPortalService,
    QuotePortalService,
  ],
})
export class SalesModule {}
