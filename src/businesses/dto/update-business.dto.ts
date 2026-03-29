// src/businesses/dto/update-business.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  // Matricule Fiscal - flexible validation
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  tax_id?: string;

  @IsOptional()
  @IsString()
  currency?: string;

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