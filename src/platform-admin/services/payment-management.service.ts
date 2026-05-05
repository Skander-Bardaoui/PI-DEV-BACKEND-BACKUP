// src/platform-admin/services/payment-management.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Subscription } from '../entities/subscription.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { EmailService } from '../../email/email.service';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { RejectPaymentDto } from '../dto/reject-payment.dto';

@Injectable()
export class PaymentManagementService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly emailService: EmailService,
  ) {}

  // ─── List All Payments ───────────────────────────────────────────────────
  async listPayments(page: number = 1, limit: number = 10) {
    const [data, total] = await this.paymentRepo.findAndCount({
      relations: ['subscription', 'subscription.tenant', 'subscription.plan'],
      order: { submitted_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Payments for a Subscription ─────────────────────────────────────
  async getSubscriptionPayments(subscriptionId: string) {
    const payments = await this.paymentRepo.find({
      where: { subscription_id: subscriptionId },
      order: { submitted_at: 'DESC' },
    });

    return payments;
  }

  // ─── Verify Payment ──────────────────────────────────────────────────────
  async verifyPayment(paymentId: string, dto: VerifyPaymentDto) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['subscription', 'subscription.tenant', 'subscription.tenant.owner', 'subscription.plan'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Payment is not pending verification');
    }

    // Update payment status
    payment.status = PaymentStatus.VERIFIED;
    if (dto.notes) {
      payment.notes = (payment.notes || '') + '\n' + dto.notes;
    }
    await this.paymentRepo.save(payment);

    // Update subscription status and dates
    const subscription = payment.subscription;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.current_period_start = new Date();

    // Calculate period end based on billing cycle
    const periodEnd = new Date();
    if (subscription.billing_cycle === 'monthly') {
      periodEnd.setDate(periodEnd.getDate() + 30);
    } else {
      periodEnd.setDate(periodEnd.getDate() + 365);
    }
    subscription.current_period_end = periodEnd;
    subscription.next_billing_at = periodEnd;
    subscription.last_payment_at = new Date();

    await this.subscriptionRepo.save(subscription);

    // Send activation email to tenant owner (business owner)
    const tenant = subscription.tenant;
    const owner = tenant.owner;
    const ownerName = `${owner.firstName} ${owner.lastName}`;
    const planName = subscription.plan.name;
    const billingCycle = subscription.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel';
    const amount = subscription.billing_cycle === 'monthly'
      ? subscription.plan.price_monthly
      : subscription.plan.price_annual;
    const nextBillingDate = subscription.next_billing_at 
      ? subscription.next_billing_at.toLocaleDateString('fr-FR')
      : 'N/A';

    await this.emailService.sendSubscriptionActivatedEmail(
      owner.email,
      ownerName,
      planName,
      billingCycle,
      amount,
      nextBillingDate,
    );

    return { message: 'Payment verified and subscription activated', payment };
  }

  // ─── Reject Payment ──────────────────────────────────────────────────────
  async rejectPayment(paymentId: string, dto: RejectPaymentDto) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['subscription', 'subscription.tenant', 'subscription.plan'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Payment is not pending verification');
    }

    // Update payment status
    payment.status = PaymentStatus.REJECTED;
    payment.notes = (payment.notes || '') + '\nRejection reason: ' + dto.reason;
    await this.paymentRepo.save(payment);

    // Revert subscription status
    const subscription = payment.subscription;
    subscription.status = SubscriptionStatus.PENDING_PAYMENT;
    await this.subscriptionRepo.save(subscription);

    // Send rejection email to tenant
    const tenant = subscription.tenant;
    await this.emailService.sendPaymentRejectedEmail(
      tenant.contactEmail,
      tenant.name,
      dto.reason,
      subscription.payment_token!,
    );

    return { message: 'Payment rejected', payment };
  }
}
