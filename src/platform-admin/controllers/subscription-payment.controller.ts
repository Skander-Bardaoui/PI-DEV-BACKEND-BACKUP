// src/platform-admin/controllers/subscription-payment.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';

@Controller('subscriptions/pay')
export class SubscriptionPaymentController {
  constructor(
    private readonly subscriptionPaymentService: SubscriptionPaymentService,
  ) {}

  // GET /api/subscriptions/pay/:token
  @Get(':token')
  async getPaymentPageData(@Param('token') token: string) {
    return this.subscriptionPaymentService.getPaymentPageData(token);
  }

  // POST /api/subscriptions/pay/:token/create-payment-intent
  @Post(':token/create-payment-intent')
  async createPaymentIntent(@Param('token') token: string) {
    return this.subscriptionPaymentService.createPaymentIntent(token);
  }

  // POST /api/subscriptions/pay/:token/confirm
  @Post(':token/confirm')
  async confirmPayment(
    @Param('token') token: string,
    @Body('paymentIntentId') paymentIntentId?: string,
    @Body('freeActivation') freeActivation?: boolean,
  ) {
    return this.subscriptionPaymentService.confirmPayment(token, paymentIntentId, freeActivation);
  }
}
