// src/platform-admin/controllers/support-ticket.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { SupportTicketService } from '../services/support-ticket.service';
import { TicketQueryDto } from '../dto/ticket-query.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { TicketReplyDto } from '../dto/ticket-reply.dto';

@Controller('platform/support/tickets')
@UseGuards(PlatformAdminGuard)
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  @Get()
  async getTickets(@Query() query: TicketQueryDto) {
    return this.ticketService.getTickets(query);
  }

  @Patch(':id')
  async updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketService.updateTicket(id, dto);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  async replyToTicket(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: TicketReplyDto,
  ) {
    await this.ticketService.replyToTicket(id, req.user.email, dto);
    return { message: 'Reply sent successfully' };
  }
}
