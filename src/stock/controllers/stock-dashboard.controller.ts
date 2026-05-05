// ==================== Alaa change for stock dashboard ====================
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { StockDashboardService } from '../services/stock-dashboard.service';
import { StockDashboardResponseDto } from '../dto/stock-dashboard.dto';

@Controller('businesses/:businessId/stock')
@UseGuards(JwtAuthGuard)
export class StockDashboardController {
  constructor(private readonly dashboardService: StockDashboardService) {}

  @Get('dashboard')
  async getDashboard(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<StockDashboardResponseDto> {
    return this.dashboardService.getDashboard(businessId);
  }

  @Get('dashboard/products')
  async getProductsDashboard(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<StockDashboardResponseDto> {
    return this.dashboardService.getProductsDashboard(businessId);
  }

  @Get('dashboard/services')
  async getServicesDashboard(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ): Promise<StockDashboardResponseDto> {
    return this.dashboardService.getServicesDashboard(businessId);
  }
}
// ====================================================================
