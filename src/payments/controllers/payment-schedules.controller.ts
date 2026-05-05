// src/payments/controllers/payment-schedules.controller.ts
import {
  Controller, Get, Post, Param, Query,
  Body, Req, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard }              from '@nestjs/passport';
import { PaymentScheduleService } from '../services/payment-schedule.service';
import { ZodValidationPipe }      from 'src/common/pipes/zod-validation.pipe';
import {
  CreatePaymentScheduleSchema,
  PayInstallmentSchema,
} from '../dto/payment-schedule';

@Controller('businesses/:businessId/payment-schedules')
export class PaymentSchedulesController {
  constructor(private readonly svc: PaymentScheduleService) {}

  // ── Authenticated routes ─────────────────────────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(new ZodValidationPipe(CreatePaymentScheduleSchema)) dto: any,
    @Req() req: any,
  ) {
    return this.svc.createSchedule(businessId, req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(businessId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('invoice/:invoiceId')
  findByInvoice(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.svc.findByInvoice(businessId, invoiceId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/installments/:installmentId/pay')
  payInstallment(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
    @Body(new ZodValidationPipe(PayInstallmentSchema)) dto: any,
    @Req() req: any,
  ) {
    return this.svc.payInstallment(
      businessId, req.user.id, id, installmentId, dto,
    );
  }

  // ── Public routes — supplier clicks link from email ──────────────
  // No JWT guard: token in URL is the authentication

  /** GET /businesses/:businessId/payment-schedules/supplier/:token/accept */
  @Get('supplier/:token/accept')
  acceptSchedule(@Param('token') token: string) {
    return this.svc.acceptSchedule(token);
  }

  /** GET /businesses/:businessId/payment-schedules/supplier/:token/reject */
  @Get('supplier/:token/reject')
  rejectSchedule(
    @Param('token') token: string,
    @Query('reason') reason?: string,
  ) {
    return this.svc.rejectSchedule(token, reason);
  }
}
