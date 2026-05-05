// src/platform-admin/controllers/dashboard.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { DashboardService } from '../services/dashboard.service';
import { RevenueTrendQueryDto } from '../dto/revenue-trend.dto';

@Controller('platform/dashboard')
@UseGuards(PlatformAdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getDashboardSummary() {
    return this.dashboardService.getDashboardSummary();
  }

  @Get('revenue-trend')
  async getRevenueTrend(@Query() query: RevenueTrendQueryDto) {
    const months = query.months || 8;
    return this.dashboardService.getRevenueTrend(months);
  }

  @Get('plan-breakdown')
  async getPlanBreakdown() {
    return this.dashboardService.getPlanBreakdown();
  }
}
