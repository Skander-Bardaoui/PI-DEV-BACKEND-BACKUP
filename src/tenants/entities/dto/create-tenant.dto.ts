// src/tenants/dto/create-tenant.dto.ts
import { IsString, IsOptional, IsObject, IsEmail } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsObject()
  settings?: object;

  @IsOptional()
  @IsString()
  billingPlan?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  ownerId: string; // The user ID who will own this tenant
}