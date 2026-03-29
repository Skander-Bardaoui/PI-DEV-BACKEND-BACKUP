// src/businesses/dto/update-business-settings.dto.ts
import { IsOptional, IsNumber, IsString, IsInt, IsObject } from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsOptional()
  @IsNumber()
  tax_rate?: number;

  @IsOptional()
  @IsString()
  invoice_prefix?: string;

  @IsOptional()
  @IsInt()
  payment_terms?: number;

  @IsOptional()
  @IsObject()
  invoice_template?: object;

  @IsOptional()
  @IsObject()
  other_settings?: object;
}