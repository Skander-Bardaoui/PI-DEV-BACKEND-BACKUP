// src/clients/dto/update-client.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsObject()
  address?: object;

  @IsOptional()
  @IsInt()
  payment_terms?: number;

  @IsOptional()
  @IsObject()
  billing_details?: object;
}