// src/platform-admin/dto/create-plan.dto.ts
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsNumber()
  @Min(0)
  price_monthly!: number;

  @IsNumber()
  @Min(0)
  price_annual!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_users?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  max_businesses?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
