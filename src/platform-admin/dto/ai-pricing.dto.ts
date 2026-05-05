// src/platform-admin/dto/ai-pricing.dto.ts
import { IsNumber, IsPositive, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AiPricingRequestDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  targetRevenue: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  tenants: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  growthRate: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  currentPrice: number;
}

export interface AiPricingResponse {
  monthlyPrice: number;
  annualPrice: number;
  predictedRevenue: number;
  retentionRate: number;
  explanation: string;
}
