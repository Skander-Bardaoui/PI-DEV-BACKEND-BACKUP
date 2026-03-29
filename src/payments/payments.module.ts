import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule }      from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';
import { Account }            from './entities/account.entity';
import { Payment }            from './entities/payment.entity';
import { SupplierPayment }    from './entities/supplier-payment.entity';
import { Transaction }        from './entities/transaction.entity';
import { Invoice }            from 'src/sales/entities/invoice.entity';
import { AccountsController }         from './controllers/accounts.controller';
import { PaymentsController }         from './controllers/payments.controller';
import { SupplierPaymentsController } from './controllers/supplier-payments.controller';
import { AccountsService }            from './services/accounts.service';
import { PaymentsService }            from './services/payments.service';
import { SupplierPaymentsService }    from './services/supplier-payments.service';
import { PurchasesModule }            from 'src/Purchases/purchases.module';
import { PurchaseInvoice } from 'src/Purchases/entities/purchase-invoice.entity';
import { TransactionsController } from './controllers/transactions.controller';
import { TransactionsService } from './services/transactions.service';
import { TransfersController } from './controllers/transfers.controller';
import { TransfersService } from './services/transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      Payment,
      SupplierPayment,
      Transaction,
      Invoice,
      PurchaseInvoice
    ]),
    forwardRef(() => PurchasesModule),
  ],
  controllers: [
    AccountsController,
    PaymentsController,
    SupplierPaymentsController,
    TransactionsController,
    TransfersController,
  ],
  providers: [
    AccountsService,
    PaymentsService,
    SupplierPaymentsService,
    TransactionsService,
    TransfersService,
  ],
  exports: [
    AccountsService,
    PaymentsService,
    SupplierPaymentsService,
    TypeOrmModule,
  ],
})
export class PaymentsModule {}
