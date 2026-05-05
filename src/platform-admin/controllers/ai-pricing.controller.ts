// src/platform-admin/controllers/ai-pricing.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../platform-auth/guards/platform-admin.guard';
import { AiPricingService } from '../services/ai-pricing.service';
import { AiPricingRequestDto, AiPricingResponse } from '../dto/ai-pricing.dto';

@Controller('platform/admin/ai')
@UseGuards(PlatformAdminGuard)
export class AiPricingController {
  constructor(private readonly aiPricingService: AiPricingService) {}

  @Post('pricing')
  async generatePricingSuggestion(
    @Body() data: AiPricingRequestDto,
  ): Promise<AiPricingResponse> {
    return this.aiPricingService.generatePricingSuggestion(data);
  }
}
