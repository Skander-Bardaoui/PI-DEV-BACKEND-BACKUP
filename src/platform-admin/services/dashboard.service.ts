// src/platform-admin/services/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { TenantApproval } from '../entities/tenant-approval.entity';
import { Plan } from '../entities/plan.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { ApprovalStatus } from '../enums/approval-status.enum';
import { TenantStatus } from '../../tenants/entities/tenant.entity';
import { BillingCycle } from '../enums/billing-cycle.enum';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { RevenueTrendItemDto } from '../dto/revenue-trend.dto';
import { PlanBreakdownItemDto } from '../dto/plan-breakdown.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TenantApproval)
    private readonly approvalRepo: Repository<TenantApproval>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async getDashboardSummary(): Promise<DashboardSummaryDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Tenant stats
    const totalTenants = await this.tenantRepo.count();
    const activeTenants = await this.tenantRepo.count({
      where: { status: TenantStatus.ACTIVE },
    });
    const suspendedTenants = await this.tenantRepo.count({
      where: { status: TenantStatus.SUSPENDED },
    });
    const newTenantsThisMonth = await this.tenantRepo.count({
      where: { createdAt: MoreThanOrEqual(startOfMonth) },
    });
    const pendingApprovals = await this.approvalRepo.count({
      where: { status: ApprovalStatus.PENDING },
    });

    // Trial subscriptions
    const trialSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.TRIAL },
    });

    // Revenue calculations
    const activeSubscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });

    let mrr = 0;
    for (const sub of activeSubscriptions) {
      if (sub.billing_cycle === BillingCycle.MONTHLY) {
        mrr += Number(sub.plan.price_monthly);
      } else {
        mrr += Number(sub.plan.price_annual) / 12;
      }
    }

    const arr = mrr * 12;

    // Overdue amount
    const overdueSubscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.OVERDUE },
      relations: ['plan'],
    });

    let overdueAmount = 0;
    for (const sub of overdueSubscriptions) {
      if (sub.billing_cycle === BillingCycle.MONTHLY) {
        overdueAmount += Number(sub.plan.price_monthly);
      } else {
        overdueAmount += Number(sub.plan.price_annual) / 12;
      }
    }

    // New MRR this month
    const newSubscriptionsThisMonth = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        created_at: MoreThanOrEqual(startOfMonth),
      },
      relations: ['plan'],
    });

    let newMrrThisMonth = 0;
    for (const sub of newSubscriptionsThisMonth) {
      if (sub.billing_cycle === BillingCycle.MONTHLY) {
        newMrrThisMonth += Number(sub.plan.price_monthly);
      } else {
        newMrrThisMonth += Number(sub.plan.price_annual) / 12;
      }
    }

    // User stats
    const totalUsers = await this.userRepo.count();
    const newUsersThisMonth = await this.userRepo.count({
      where: { created_at: MoreThanOrEqual(startOfMonth) },
    });

    // Churn rate: cancelled this month / active start of month * 100
    const cancelledThisMonth = await this.subscriptionRepo.count({
      where: {
        status: SubscriptionStatus.CANCELLED,
        cancelled_at: MoreThanOrEqual(startOfMonth),
      },
    });

    const activeStartOfMonth = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('sub.created_at < :startOfMonth', { startOfMonth })
      .getCount();

    const churnRate = activeStartOfMonth > 0 ? (cancelledThisMonth / activeStartOfMonth) * 100 : 0;

    // Trial conversion rate: trials converted to paid this month / trials started last month * 100
    const trialsStartedLastMonth = await this.subscriptionRepo.count({
      where: {
        status: SubscriptionStatus.TRIAL,
        created_at: MoreThanOrEqual(startOfLastMonth),
      },
    });

    const trialsConvertedThisMonth = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('sub.trial_ends_at IS NOT NULL')
      .andWhere('sub.updated_at >= :startOfMonth', { startOfMonth })
      .andWhere('sub.created_at >= :startOfLastMonth', { startOfLastMonth })
      .andWhere('sub.created_at < :startOfMonth', { startOfMonth })
      .getCount();

    const trialConversionRate =
      trialsStartedLastMonth > 0 ? (trialsConvertedThisMonth / trialsStartedLastMonth) * 100 : 0;

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialSubscriptions,
        suspended: suspendedTenants,
        pendingApproval: pendingApprovals,
        newThisMonth: newTenantsThisMonth,
      },
      revenue: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        newMrrThisMonth: Math.round(newMrrThisMonth * 100) / 100,
      },
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
      },
      churnRate: Math.round(churnRate * 100) / 100,
      trialConversionRate: Math.round(trialConversionRate * 100) / 100,
    };
  }

  async getRevenueTrend(months: number): Promise<RevenueTrendItemDto[]> {
    const result: RevenueTrendItemDto[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      // Calculate MRR for this month
      const activeSubscriptions = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .leftJoinAndSelect('sub.plan', 'plan')
        .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('sub.created_at < :nextMonth', { nextMonth: nextMonthDate })
        .andWhere(
          '(sub.cancelled_at IS NULL OR sub.cancelled_at >= :currentMonth)',
          { currentMonth: monthDate },
        )
        .getMany();

      let mrr = 0;
      for (const sub of activeSubscriptions) {
        if (sub.billing_cycle === BillingCycle.MONTHLY) {
          mrr += Number(sub.plan.price_monthly);
        } else {
          mrr += Number(sub.plan.price_annual) / 12;
        }
      }

      // New tenants this month
      const newTenants = await this.tenantRepo.count({
        where: {
          createdAt: MoreThanOrEqual(monthDate),
        },
      });

      // Churned this month
      const churned = await this.subscriptionRepo.count({
        where: {
          status: SubscriptionStatus.CANCELLED,
          cancelled_at: MoreThanOrEqual(monthDate),
        },
      });

      result.push({
        month: monthStr,
        mrr: Math.round(mrr * 100) / 100,
        newTenants,
        churned,
      });
    }

    return result;
  }

  async getPlanBreakdown(): Promise<PlanBreakdownItemDto[]> {
    const plans = await this.planRepo.find({ where: { is_active: true } });
    const activeSubscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });

    let totalRevenue = 0;
    const planStats = new Map<string, { count: number; revenue: number }>();

    for (const sub of activeSubscriptions) {
      const revenue =
        sub.billing_cycle === BillingCycle.MONTHLY
          ? Number(sub.plan.price_monthly)
          : Number(sub.plan.price_annual) / 12;

      totalRevenue += revenue;

      const existing = planStats.get(sub.plan_id) || { count: 0, revenue: 0 };
      planStats.set(sub.plan_id, {
        count: existing.count + 1,
        revenue: existing.revenue + revenue,
      });
    }

    const result: PlanBreakdownItemDto[] = [];

    for (const plan of plans) {
      const stats = planStats.get(plan.id) || { count: 0, revenue: 0 };
      const percentage = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0;

      result.push({
        planId: plan.id,
        planName: plan.name,
        tenantCount: stats.count,
        monthlyRevenue: Math.round(stats.revenue * 100) / 100,
        percentageOfTotal: Math.round(percentage * 100) / 100,
      });
    }

    return result.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  }
}
