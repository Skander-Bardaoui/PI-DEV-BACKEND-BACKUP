// src/platform-admin/controllers/stripe-webhook.controller.ts
import {
  Controller,
  Post,
  Headers,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionPaymentService } from '../services/subscription-payment.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly subscriptionPaymentService: SubscriptionPaymentService,
  ) {}

  @Post()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      throw new Error('Raw body is required for webhook signature verification');
    }

    return this.subscriptionPaymentService.handleWebhook(rawBody, signature);
  }
}
