// src/platform-admin/dto/dashboard-summary.dto.ts
export class DashboardSummaryDto {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    pendingApproval: number;
    newThisMonth: number;
  };

  revenue: {
    mrr: number;
    arr: number;
    overdueAmount: number;
    newMrrThisMonth: number;
  };

  users: {
    total: number;
    newThisMonth: number;
  };

  churnRate: number;
  trialConversionRate: number;
}
