// src/platform-admin/dto/plan-breakdown.dto.ts
export class PlanBreakdownItemDto {
  planId: string;
  planName: string;
  tenantCount: number;
  monthlyRevenue: number;
  percentageOfTotal: number;
}
