// src/platform-admin/dto/submit-payment.dto.ts
import { IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';

export class SubmitPaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  payer_name!: string;

  @IsString()
  payer_phone!: string;

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
