import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RecurringInvoicePaymentsService } from '../services/recurring-invoice-payments.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('recurring-invoice-payments')
export class RecurringInvoicePaymentsController {
  constructor(
    private readonly recurringInvoicePaymentsService: RecurringInvoicePaymentsService,
  ) {}

  // GET /recurring-invoice-payments - Get all recurring invoices for the business
  @Get()
  async findAll(@Req() req: any) {
    return this.recurringInvoicePaymentsService.findAll(req.user.business_id);
  }

  // GET /recurring-invoice-payments/:id - Get single recurring invoice
  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringInvoicePaymentsService.findOne(
      req.user.business_id,
      id,
    );
  }

  // POST /recurring-invoice-payments/:id/validate-payment - Validate payment for recurring invoice
  @Post(':id/validate-payment')
  async validatePayment(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { account_id: string; payment_date: string; reference?: string; notes?: string },
  ) {
    return this.recurringInvoicePaymentsService.validatePayment(
      req.user.business_id,
      req.user.id,
      id,
      dto,
    );
  }

  // POST /recurring-invoice-payments/:id/send-reminder - Send reminder email for recurring invoice
  @Post(':id/send-reminder')
  async sendReminder(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringInvoicePaymentsService.sendReminder(
      req.user.business_id,
      id,
    );
  }
}
