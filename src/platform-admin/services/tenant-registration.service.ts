// src/platform-admin/services/tenant-registration.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TenantApproval } from '../entities/tenant-approval.entity';
import { Subscription } from '../entities/subscription.entity';
import { Plan } from '../entities/plan.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';

@Injectable()
export class TenantRegistrationService {
  constructor(
    @InjectRepository(TenantApproval)
    private readonly approvalRepo: Repository<TenantApproval>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  // ─── Create Approval and Subscription for New Tenant ────────────────────
  async createTenantApprovalAndSubscription(tenantId: string, planId: string, billingCycle: BillingCycle) {
    // Create tenant approval with pending status
    const approval = this.approvalRepo.create({
      tenant_id: tenantId,
      status: ApprovalStatus.PENDING,
    });
    await this.approvalRepo.save(approval);

    // Validate the selected plan
    const selectedPlan = await this.planRepo.findOne({
      where: { id: planId, is_active: true },
    });

    if (!selectedPlan) {
      throw new Error('Selected plan not found or inactive');
    }

    // Create subscription with pending_payment status
    const now = new Date();
    
    // Calculate period end based on plan type
    let periodEnd = new Date(now);
    
    if (selectedPlan.slug === 'free') {
      // Free plan: 7 days trial
      periodEnd.setDate(periodEnd.getDate() + 7);
    } else if (billingCycle === BillingCycle.MONTHLY) {
      // Monthly plan: 30 days
      periodEnd.setDate(periodEnd.getDate() + 30);
    } else {
      // Annual plan: 365 days
      periodEnd.setDate(periodEnd.getDate() + 365);
    }

    const subscription = this.subscriptionRepo.create({
      tenant_id: tenantId,
      plan_id: selectedPlan.id,
      status: SubscriptionStatus.PENDING_PAYMENT,
      billing_cycle: billingCycle,
      current_period_start: now,
      current_period_end: periodEnd,
      trial_ends_at: selectedPlan.slug === 'free' ? periodEnd : undefined, // Only free plan has trial
      next_billing_at: periodEnd,
      payment_token: uuidv4(), // Generate payment token
    });

    await this.subscriptionRepo.save(subscription);

    return { approval, subscription };
  }

  // ─── Check if Tenant Can Login ───────────────────────────────────────────
  async checkTenantLoginPermission(tenantId: string): Promise<{ canLogin: boolean; message?: string }> {
    // Check approval status
    const approval = await this.approvalRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!approval || approval.status !== ApprovalStatus.APPROVED) {
      return {
        canLogin: false,
        message: 'Account pending approval',
      };
    }

    // Check subscription status
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenant_id: tenantId },
    });

    if (!subscription) {
      return {
        canLogin: false,
        message: 'No active subscription found',
      };
    }

    // ⚠️ PRIORITY 1: Check if account is suspended (highest priority)
    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      return {
        canLogin: false,
        message: 'Your subscription has been suspended. Please contact support for assistance.',
      };
    }

    // ⚠️ PRIORITY 2: Check if subscription is cancelled
    if (subscription.status === SubscriptionStatus.CANCELLED) {
      return {
        canLogin: false,
        message: 'Your subscription has been cancelled. Please contact support to reactivate your account.',
      };
    }

    // ⚠️ PRIORITY 3: Check if payment is pending
    if (subscription.status === SubscriptionStatus.PENDING_PAYMENT) {
      return {
        canLogin: false,
        message: 'Please complete your subscription payment to activate your account.',
      };
    }

    // ⚠️ PRIORITY 4: Check if payment is submitted but not verified
    if (subscription.status === SubscriptionStatus.PAYMENT_SUBMITTED) {
      return {
        canLogin: false,
        message: 'Your payment is being verified. You will receive an email once approved.',
      };
    }

    return { canLogin: true };
  }
}