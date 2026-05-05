// src/payments/controllers/forecast.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ForecastService } from '../services/forecast.service';
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

@UseGuards(JwtAuthGuard)
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  // GET /forecast/cashflow
  @Get('cashflow')
  @UseGuards(AiFeatureGuard)
  async getCashFlow(@Req() req: any) {
    return this.forecastService.getCashFlowForecast(req.user.business_id);
  }
}
