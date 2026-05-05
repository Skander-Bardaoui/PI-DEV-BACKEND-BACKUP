import { IsOptional, IsString, IsBoolean, IsUUID, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export enum CategorySortBy {
  NAME = 'name',
  SORT_ORDER = 'sort_order',
  CREATED_AT = 'created_at',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryCategoriesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsUUID()
  parent_id?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  root_only?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  has_products?: boolean;

  @IsOptional()
  @IsEnum(CategorySortBy)
  sort_by?: CategorySortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;

  // ==================== Alaa change for service type ====================
  @IsOptional()
  @IsString()
  category_type?: string; // 'PRODUCT' or 'SERVICE'
  // ====================================================================
}
