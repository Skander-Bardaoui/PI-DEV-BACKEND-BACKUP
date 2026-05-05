import { IsOptional, IsString, IsBoolean, IsUUID, IsNumber, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductType } from '../entities/product.entity';

export enum ProductSortBy {
  NAME = 'name',
  PRICE = 'price',
  QUANTITY = 'quantity',
  CREATED_AT = 'created_at',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  warehouse_id?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_stockable?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  low_stock?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  out_of_stock?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  has_barcode?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  price_min?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  price_max?: number;

  @IsOptional()
  @IsEnum(ProductSortBy)
  sort_by?: ProductSortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;

  // ==================== Alaa change for service type ====================
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;
  // ====================================================================
}
