// src/platform-admin/controllers/subscription-management.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { SubscriptionManagementService } from '../services/subscription-management.service';
import { SubscriptionQueryDto } from '../dto/subscription-query.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';

@Controller('platform/subscriptions')
@UseGuards(PlatformAdminGuard)
export class SubscriptionManagementController {
  constructor(private readonly subscriptionService: SubscriptionManagementService) {}

  // ─── List Subscriptions ──────────────────────────────────────────────────
  @Get()
  async listSubscriptions(@Query() query: SubscriptionQueryDto) {
    return this.subscriptionService.listSubscriptions(query);
  }

  // ─── Get Overdue Subscriptions ───────────────────────────────────────────
  @Get('overdue')
  async getOverdueSubscriptions() {
    return this.subscriptionService.getOverdueSubscriptions();
  }

  // ─── Update Subscription ─────────────────────────────────────────────────
  @Patch(':id')
  async updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionService.updateSubscription(id, dto);
  }

  // ─── Mark Subscription as Paid ───────────────────────────────────────────
  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  async markAsPaid(@Param('id') id: string) {
    return this.subscriptionService.markAsPaid(id);
  }

  // ─── Resend Payment Email ────────────────────────────────────────────────
  @Post(':id/resend-payment-email')
  @HttpCode(HttpStatus.OK)
  async resendPaymentEmail(@Param('id') id: string) {
    return this.subscriptionService.resendPaymentEmail(id);
  }

  // ─── Cancel Subscription ─────────────────────────────────────────────────
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Param('id') id: string) {
    return this.subscriptionService.cancelSubscription(id);
  }

  // ─── Reactivate Subscription ─────────────────────────────────────────────
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateSubscription(@Param('id') id: string) {
    return this.subscriptionService.reactivateSubscription(id);
  }

  // ─── Suspend Subscription ────────────────────────────────────────────────
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendSubscription(@Param('id') id: string) {
    return this.subscriptionService.suspendSubscription(id);
  }

  // ─── Unsuspend Subscription ──────────────────────────────────────────────
  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspendSubscription(@Param('id') id: string) {
    return this.subscriptionService.unsuspendSubscription(id);
  }
}