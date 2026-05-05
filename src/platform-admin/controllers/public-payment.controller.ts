// src/platform-admin/controllers/public-payment.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { Payment } from '../entities/payment.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { SubmitPaymentDto } from '../dto/submit-payment.dto';
import { EmailService } from '../../email/email.service';
import { ConfigService } from '@nestjs/config';

@Controller('api/subscriptions/pay')
export class PublicPaymentController {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Get Payment Info by Token (Public) ──────────────────────────────────
  @Get(':token')
  async getPaymentInfo(@Param('token') token: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { payment_token: token },
      relations: ['tenant', 'plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Payment link not found or expired');
    }

    return {
      tenantName: subscription.tenant.name,
      planName: subscription.plan.name,
      priceMonthly: subscription.plan.price_monthly,
      priceAnnual: subscription.plan.price_annual,
      billingCycle: subscription.billing_cycle,
      amount:
        subscription.billing_cycle === 'monthly'
          ? subscription.plan.price_monthly
          : subscription.plan.price_annual,
      currency: 'TND',
    };
  }

  // ─── Submit Payment (Public) ─────────────────────────────────────────────
  @Post(':token/submit')
  async submitPayment(@Param('token') token: string, @Body() dto: SubmitPaymentDto) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { payment_token: token },
      relations: ['tenant', 'plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Payment link not found or expired');
    }

    if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Payment already submitted or subscription is not pending payment');
    }

    // Calculate amount
    const amount =
      subscription.billing_cycle === 'monthly'
        ? subscription.plan.price_monthly
        : subscription.plan.price_annual;

    // Create payment record
    const payment = this.paymentRepo.create({
      subscription_id: subscription.id,
      amount,
      currency: 'TND',
      method: dto.method,
      reference_number: dto.reference_number,
      payer_name: dto.payer_name,
      payer_phone: dto.payer_phone,
      notes: dto.notes,
      status: PaymentStatus.PENDING_VERIFICATION,
      submitted_at: new Date(),
    });

    await this.paymentRepo.save(payment);

    // Update subscription status
    subscription.status = SubscriptionStatus.PAYMENT_SUBMITTED;
    await this.subscriptionRepo.save(subscription);

    // Send email to platform admin
    const adminEmail = this.configService.get<string>('PLATFORM_ADMIN_EMAIL');
    if (adminEmail) {
      await this.emailService.sendPaymentSubmittedNotification(
        adminEmail,
        subscription.tenant.name,
        subscription.plan.name,
        amount,
        dto.method,
        dto.payer_name,
        dto.payer_phone,
        dto.reference_number,
      );
    }

    return {
      message: 'Payment details submitted successfully',
      paymentId: payment.id,
    };
  }
}
