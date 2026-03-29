import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ClientPortalService } from './services/client-portal.service';
import { SalesDashboardService } from './services/sales-dashboard.service';
import { SalesMatchingService } from './services/sales-matching.service';
import { QuotesController } from './controllers/quotes.controller';
import { SalesOrdersController } from './controllers/sales-orders.controller';
import { DeliveryNotesController } from './controllers/delivery-notes.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { SalesOcrController } from './controllers/sales-ocr.controller';
import { RecurringInvoicesController } from './controllers/recurring-invoices.controller';
import { ClientPortalController } from './controllers/client-portal.controller';
import { SalesDashboardController } from './controllers/sales-dashboard.controller';
import { SalesMatchingController } from './controllers/sales-matching.controller';
import { Client } from '../clients/entities/client.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    BusinessesModule, // Import BusinessesModule to get BusinessAccessGuard dependencies
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
      Client,
      Business,
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
    ClientPortalService,
    SalesDashboardService,
    SalesMatchingService,
  ],
  controllers: [
    QuotesController,
    SalesOrdersController,
    DeliveryNotesController,
    InvoicesController,
    SalesOcrController,
    RecurringInvoicesController,
    ClientPortalController,
    SalesDashboardController,
    SalesMatchingController,
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
  ],
})
export class SalesModule {}