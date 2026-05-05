// src/support/support.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportController } from './support.controller';
import { SupportTicket } from '../platform-admin/entities/support-ticket.entity';
import { SupportTicketService } from '../platform-admin/services/support-ticket.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket]), EmailModule],
  controllers: [SupportController],
  providers: [SupportTicketService],
})
export class SupportModule {}
