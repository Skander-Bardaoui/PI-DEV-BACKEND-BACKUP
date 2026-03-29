// src/businesses/dto/create-business.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBusinessDto {
  // tenant_id and logo are added by the controller, not validated here
  tenant_id?: string;
  logo?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  // Matricule Fiscal validation (Tunisian tax ID)
  // Format: NNNNNNN/X/A/E/NNN (7-20 characters)
  // Made more flexible to accept various formats
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  tax_id?: string;

  @IsOptional()
  @IsString()
  currency?: string; // Defaults to TND

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsNumber()
  tax_rate?: number;

  @IsOptional()
  @IsObject()
  address?: object;
}