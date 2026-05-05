// src/businesses/businesses.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BusinessesService } from './businesses.service';
import { BusinessMembersService } from './services/business-members.service';
import { InvitationsService } from './services/invitations.service';
import { GlobalAiAssistantService } from './services/global-ai-assistant.service';
import { BusinessesController } from './businesses.controller';
import { GlobalAiAssistantController } from './controllers/global-ai-assistant.controller';
import { PermissionGuard } from './guards/permission.guard';
import {
  InvitationsController,
  BusinessInvitationsController,
} from './controllers/invitations.controller';
import { Business } from './entities/business.entity';
import { BusinessSettings } from './entities/business-settings.entity';
import { TaxRate } from './entities/tax-rate.entity';
import { BusinessMember } from './entities/business-member.entity';
import { BusinessInvitation } from './entities/business-invitation.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';

// Import entities from other modules for AI assistant
import { Invoice } from '../sales/entities/invoice.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { Quote } from '../sales/entities/quote.entity';
import { Client } from '../sales/entities/client.entity';
import { SupplierPO } from '../Purchases/entities/supplier-po.entity';
import { Supplier } from '../Purchases/entities/supplier.entity';
import { Product } from '../stock/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Task } from '../collaboration/entities/task.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { Account } from '../payments/entities/account.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Business,
      BusinessSettings,
      TaxRate,
      BusinessMember,
      BusinessInvitation,
      Tenant,
      User,
      // Entities for AI assistant
      Invoice,
      SalesOrder,
      Quote,
      Client,
      SupplierPO,
      Supplier,
      Product,
      StockMovement,
      Task,
      Transaction,
      Account,
    ]),
  ],
  providers: [
    BusinessesService, 
    BusinessMembersService, 
    InvitationsService,
    GlobalAiAssistantService,
    PermissionGuard,
  ],
  controllers: [
    BusinessesController,
    InvitationsController,
    BusinessInvitationsController,
    GlobalAiAssistantController,
  ],
  exports: [
    BusinessesService, 
    BusinessMembersService, 
    InvitationsService,
    PermissionGuard, // Export PermissionGuard for use in other modules
    TypeOrmModule, // Export TypeOrmModule to make repositories available
  ],
})
export class BusinessesModule {}