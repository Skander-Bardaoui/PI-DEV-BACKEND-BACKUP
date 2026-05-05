// src/platform-admin/controllers/payment-management.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { PaymentManagementService } from '../services/payment-management.service';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { RejectPaymentDto } from '../dto/reject-payment.dto';

@Controller('platform/subscriptions/payments')
@UseGuards(PlatformAdminGuard)
export class PaymentManagementController {
  constructor(private readonly paymentService: PaymentManagementService) {}

  // ─── List All Payments ───────────────────────────────────────────────────
  @Get()
  async listPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.paymentService.listPayments(page, limit);
  }

  // ─── Get Payments for Subscription ───────────────────────────────────────
  @Get('subscription/:subscriptionId')
  async getSubscriptionPayments(@Param('subscriptionId') subscriptionId: string) {
    return this.paymentService.getSubscriptionPayments(subscriptionId);
  }

  // ─── Verify Payment ──────────────────────────────────────────────────────
  @Post(':paymentId/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Param('paymentId') paymentId: string, @Body() dto: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(paymentId, dto);
  }

  // ─── Reject Payment ──────────────────────────────────────────────────────
  @Post(':paymentId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectPayment(@Param('paymentId') paymentId: string, @Body() dto: RejectPaymentDto) {
    return this.paymentService.rejectPayment(paymentId, dto);
  }
}
