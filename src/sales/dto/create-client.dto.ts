// src/sales/dto/create-client.dto.ts
import { IsString, IsEmail, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  payment_terms?: string;

  @IsString()
  @IsOptional()
  billing_details?: string;

  @IsString()
  @IsOptional()
  communication_history?: string;

  @IsBoolean()
  @IsOptional()
  has_portal_access?: boolean;
}
