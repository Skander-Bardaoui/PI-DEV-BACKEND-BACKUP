// src/app.module.ts
import { Controller, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
// Core Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { BusinessesModule } from './businesses/businesses.module';
import { ClientsModule } from './clients/clients.module';

// Sales & Finance Modules
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';

// Stock Module
import { StockModule } from './stock/stock.module';

// Tasks Module
import { TasksModule } from './tasks/tasks.module';

// Messages Module
import { MessagesModule } from './messages/messages.module';

// Core Entities
import { User } from './users/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { PasswordResetToken } from './auth/entities/password-reset-token.entity';
import { Tenant } from './tenants/entities/tenant.entity';
import { Business } from './businesses/entities/business.entity';
import { BusinessSettings } from './businesses/entities/business-settings.entity';
import { TaxRate } from './businesses/entities/tax-rate.entity';
import { Client } from './clients/entities/client.entity';
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

// Tasks Entities
import { Task } from './tasks/entities/task.entity';

// Messages Entities
import { Message } from './messages/entities/message.entity';

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

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: +(configService.get<number>('DB_PORT') ?? 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
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
           SupplierPortalToken,
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

          // Tasks
          Task,

          // Messages
          Message,
        ],
      }),
      inject: [ConfigService],
    }),

    // Core Modules
    UsersModule,
    AuthModule,
    TenantsModule,
    BusinessesModule,
    ClientsModule,

    // Sales & Finance
    SalesModule,
    PaymentsModule,


    // Purchases
    PurchasesModule,

    // Stock
    StockModule,

    // Tasks
    TasksModule,

    // Messages
    MessagesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}