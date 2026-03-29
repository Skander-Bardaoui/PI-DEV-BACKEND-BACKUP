import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from '../services/payments.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreatePaymentSchema } from '../dto/create-payment.dto';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // POST /payments
  @Post()
  async create(
    @Req() req: any,
    @Body(new ZodValidationPipe(CreatePaymentSchema)) dto: any,
  ) {
    return this.paymentsService.create(req.user.business_id, req.user.id, dto);
  }

  // GET /payments
  @Get()
  async findAll(@Req() req: any) {
    return this.paymentsService.findAll(req.user.business_id);
  }

  // GET /payments/:id
  @Get(':id')
  async findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.findOne(req.user.business_id, id);
  }

  // GET /payments/invoice/:invoiceId
  @Get('invoice/:invoiceId')
  async findByInvoice(
    @Req() req: any,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.paymentsService.findByInvoice(req.user.business_id, invoiceId);
  }
}
