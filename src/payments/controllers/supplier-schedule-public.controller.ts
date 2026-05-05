// src/payments/controllers/supplier-schedule-public.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { PaymentScheduleService } from '../services/payment-schedule.service';

@Controller('supplier-schedule')
export class SupplierSchedulePublicController {
  constructor(private readonly svc: PaymentScheduleService) {}

  /** GET /supplier-schedule/:token/accept */
  @Get(':token/accept')
  acceptSchedule(@Param('token') token: string) {
    return this.svc.acceptSchedule(token);
  }

  /** GET /supplier-schedule/:token/reject */
  @Get(':token/reject')
  rejectSchedule(
    @Param('token') token: string,
    @Query('reason') reason?: string,
  ) {
    return this.svc.rejectSchedule(token, reason);
  }
}
