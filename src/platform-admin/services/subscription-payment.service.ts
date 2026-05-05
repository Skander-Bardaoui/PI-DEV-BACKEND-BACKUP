// src/platform-admin/services/subscription-payment.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Subscription } from '../entities/subscription.entity';
import { Payment } from '../entities/payment.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { EmailService } from '../../email/email.service';
import { Business } from '../../businesses/entities/business.entity';

@Injectable()
export class SubscriptionPaymentService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  // Get payment page data
  async getPaymentPageData(token: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { payment_token: token },
      relations: ['tenant', 'tenant.owner', 'plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Payment link not found');
    }

    const amount = subscription.billing_cycle === 'monthly'
      ? subscription.plan.price_monthly
      : subscription.plan.price_annual;

    return {
      tenantName: subscription.tenant.name,
      ownerName: `${subscription.tenant.owner.firstName} ${subscription.tenant.owner.lastName}`,
      planName: subscription.plan.name,
      billingCycle: subscription.billing_cycle,
      amount,
      currency: 'TND',
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  }

  // Create Stripe PaymentIntent
  async createPaymentIntent(token: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { payment_token: token },
      relations: ['tenant', 'plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Payment link not found');
    }

    if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) {
      throw new BadRequestException(`Subscription is already ${subscription.status}`);
    }

    // Calculate amount in cents (USD uses 2 decimal places)
    const amount = subscription.billing_cycle === 'monthly'
      ? subscription.plan.price_monthly
      : subscription.plan.price_annual;
    
    const amountInCents = Math.round(amount * 100);

    // Create PaymentIntent with USD currency (Stripe supported)
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        subscriptionId: subscription.id,
        tenantId: subscription.tenant_id,
        paymentToken: token,
        planName: subscription.plan.name,
        billingCycle: subscription.billing_cycle,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  }

  // Confirm payment and activate subscription
  async confirmPayment(token: string, paymentIntentId?: string, freeActivation?: boolean) {
    // Get subscription
    const subscription = await this.subscriptionRepo.findOne({
      where: { payment_token: token },
      relations: ['tenant', 'tenant.owner', 'plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check if already activated
    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return { success: true, message: 'Subscription already activated' };
    }

    // FREE PLAN ACTIVATION (skip Stripe)
    if (freeActivation === true || subscription.plan.slug === 'free') {
      // Verify this is actually a free plan
      const amount = subscription.billing_cycle === 'monthly'
        ? subscription.plan.price_monthly
        : subscription.plan.price_annual;

      if (amount !== 0) {
        throw new BadRequestException('Free activation is only allowed for free plans');
      }

      // Activate free trial
      await this.activateFreeTrialSubscription(subscription);
      return { success: true, message: 'Free trial activated' };
    }

    // PAID PLAN ACTIVATION (Stripe required)
    if (!paymentIntentId) {
      throw new BadRequestException('Payment intent ID is required for paid plans');
    }

    // Retrieve PaymentIntent from Stripe
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException('Payment not completed');
    }

    // Verify token matches
    if (paymentIntent.metadata.paymentToken !== token) {
      throw new BadRequestException('Invalid payment token');
    }

    // Activate subscription
    await this.activateSubscription(subscription, paymentIntentId);

    return { success: true, message: 'Subscription activated' };
  }

  // Activate subscription (used by both confirm endpoint and webhook)
  private async activateSubscription(subscription: Subscription, paymentIntentId: string) {
    const now = new Date();
    const amount = subscription.billing_cycle === 'monthly'
      ? subscription.plan.price_monthly
      : subscription.plan.price_annual;

    // Calculate period end
    const periodEnd = new Date(now);
    if (subscription.billing_cycle === 'monthly') {
      periodEnd.setDate(periodEnd.getDate() + 30);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 365);
    }

    // Update subscription
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.last_payment_at = now;
    subscription.current_period_start = now;
    subscription.current_period_end = periodEnd;
    subscription.next_billing_at = periodEnd;
    subscription.payment_method = 'CARTE';
    await this.subscriptionRepo.save(subscription);

    // Get the first business for this tenant (for business_id requirement)
    const business = await this.businessRepo.findOne({
      where: { tenant_id: subscription.tenant_id },
      order: { created_at: 'ASC' },
    });

    // Create payment record
    const paymentData: any = {
      subscription_id: subscription.id,
      amount,
      currency: 'TND',
      method: PaymentMethod.CARD,
      stripe_payment_intent_id: paymentIntentId,
      status: PaymentStatus.VERIFIED,
      submitted_at: now,
      payer_name: `${subscription.tenant.owner.firstName} ${subscription.tenant.owner.lastName}`,
      payer_phone: subscription.tenant.owner.phone || 'N/A',
    };

    // Add business_id if business exists
    if (business?.id) {
      paymentData.business_id = business.id;
    }

    await this.paymentRepo.save(paymentData);

    // Send activation email
    await this.sendActivationEmail(subscription);
  }

  // Activate free trial subscription (no Stripe, no payment record)
  private async activateFreeTrialSubscription(subscription: Subscription) {
    const now = new Date();
    
    // Calculate 7-day trial period
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    // Update subscription
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.current_period_start = now;
    subscription.current_period_end = trialEnd;
    subscription.trial_ends_at = trialEnd;
    subscription.payment_method = 'free';
    subscription.last_payment_at = now;
    subscription.next_billing_at = undefined; // No next billing for free plan
    await this.subscriptionRepo.save(subscription);

    // Do NOT create a payment record for free plans

    // Send activation email
    await this.sendActivationEmail(subscription);
  }

  // Handle Stripe webhook
  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // Handle events
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const { paymentToken, subscriptionId } = paymentIntent.metadata;

    if (!paymentToken || !subscriptionId) {
      console.error('Missing metadata in PaymentIntent');
      return;
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
      relations: ['tenant', 'tenant.owner', 'plan'],
    });

    if (!subscription) {
      console.error(`Subscription not found: ${subscriptionId}`);
      return;
    }

    // Only activate if still pending payment
    if (subscription.status === SubscriptionStatus.PENDING_PAYMENT) {
      await this.activateSubscription(subscription, paymentIntent.id);
      console.log(`Subscription ${subscriptionId} activated via webhook`);
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const { subscriptionId } = paymentIntent.metadata;
    console.error(`Payment failed for subscription: ${subscriptionId}`);
    
    // Optionally send failure email to tenant owner
    // TODO: Implement payment failure email
  }

  private async sendActivationEmail(subscription: Subscription) {
    const ownerName = `${subscription.tenant.owner.firstName} ${subscription.tenant.owner.lastName}`;
    const ownerEmail = subscription.tenant.owner.email;
    const planName = subscription.plan.name;
    const billingCycle = subscription.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel';
    const amount = subscription.billing_cycle === 'monthly'
      ? subscription.plan.price_monthly
      : subscription.plan.price_annual;
    const nextBillingDate = subscription.next_billing_at 
      ? subscription.next_billing_at.toLocaleDateString('fr-FR')
      : 'N/A';

    await this.emailService.sendSubscriptionActivatedEmail(
      ownerEmail,
      ownerName,
      planName,
      billingCycle,
      amount,
      nextBillingDate,
    );
  }
}
