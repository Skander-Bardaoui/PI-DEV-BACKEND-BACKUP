import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../../businesses/guards/business-access.guard';
import { SalesMLService, SalesForecastResponse, ClientChurnResponse } from '../services/sales-ml.service';
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

@Controller('businesses/:businessId/sales/ml')
@UseGuards(JwtAuthGuard, BusinessAccessGuard)
export class SalesMLController {
  constructor(private readonly salesMLService: SalesMLService) {}

  @Get('forecast')
  @UseGuards(AiFeatureGuard)
  async getSalesForecast(
    @Param('businessId') businessId: string,
    @Query('days') days?: string,
  ): Promise<SalesForecastResponse> {
    const forecastDays = days ? parseInt(days, 10) : 30;
    return this.salesMLService.getSalesForecast(businessId, forecastDays);
  }

  @Get('churn/client/:clientId')
  async getClientChurnRisk(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
  ): Promise<ClientChurnResponse> {
    return this.salesMLService.getClientChurnRisk(clientId);
  }

  @Get('churn/high-risk')
  async getHighRiskClients(@Param('businessId') businessId: string): Promise<ClientChurnResponse[]> {
    return this.salesMLService.getHighRiskClients(businessId);
  }
}
