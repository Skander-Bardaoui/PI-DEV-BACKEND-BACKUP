// src/platform-admin/dto/update-subscription.dto.ts
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  plan_id?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(BillingCycle)
  billing_cycle?: BillingCycle;

  @IsOptional()
  @IsDateString()
  current_period_start?: string;

  @IsOptional()
  @IsDateString()
  current_period_end?: string;

  @IsOptional()
  @IsDateString()
  trial_ends_at?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsDateString()
  next_billing_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
