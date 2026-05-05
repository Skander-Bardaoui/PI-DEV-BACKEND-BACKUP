// src/platform-admin/dto/verify-payment.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
