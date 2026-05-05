// src/platform-admin/dto/revenue-trend.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RevenueTrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number = 8;
}

export class RevenueTrendItemDto {
  month: string; // YYYY-MM
  mrr: number;
  newTenants: number;
  churned: number;
}
