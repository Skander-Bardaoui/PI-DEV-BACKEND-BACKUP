// src/support/support.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupportTicketService } from '../platform-admin/services/support-ticket.service';
import { CreateTicketDto } from '../platform-admin/dto/create-ticket.dto';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Post()
  async createTicket(@Request() req: any, @Body() dto: CreateTicketDto) {
    // Assuming req.user contains userId and tenantId from JWT
    const userId = req.user.id;
    const tenantId = req.user.tenantId || req.user.tenant_id;

    return this.ticketService.createTicket(userId, tenantId, dto);
  }
}
