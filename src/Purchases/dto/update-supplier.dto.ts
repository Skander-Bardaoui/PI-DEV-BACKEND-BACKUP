// src/Purchases/dto/update-supplier.dto.ts
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AddressDto } from './create-supplier.dto';
 
export class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @IsString() matricule_fiscal?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
 
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
 
  @IsOptional() @IsString() rib?: string;
  @IsOptional() @IsString() @MaxLength(100) bank_name?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(365) payment_terms?: number;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
 
  // is_active dans UpdateSupplierDto : déjà correct (boolean direct depuis le body JSON)
  @IsOptional() @IsBoolean() is_active?: boolean;
}
 
export class QuerySuppliersDto {
  @IsOptional()
  @IsString()
  search?: string;
 
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true'  || value === true)  return true;
    if (value === 'false' || value === false) return false;
    return undefined; // pas de filtre si absent
  })
  @IsBoolean()
  is_active?: boolean;
 
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsNumber()
  @Min(1)
  page?: number = 1;
 
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 20)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}