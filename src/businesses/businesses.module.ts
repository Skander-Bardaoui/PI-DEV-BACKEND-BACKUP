// src/businesses/businesses.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BusinessesService } from './businesses.service';
import { BusinessMembersService } from './services/business-members.service';
import { InvitationsService } from './services/invitations.service';
import { BusinessesController } from './businesses.controller';
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
    ]),
  ],
  providers: [BusinessesService, BusinessMembersService, InvitationsService],
  controllers: [
    BusinessesController,
    InvitationsController,
    BusinessInvitationsController,
  ],
  exports: [
    BusinessesService, 
    BusinessMembersService, 
    InvitationsService,
    TypeOrmModule, // Export TypeOrmModule to make repositories available
  ],
})
export class BusinessesModule {}