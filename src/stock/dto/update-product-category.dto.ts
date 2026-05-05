import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateProductCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  // ==================== Alaa change for service type ====================
  @IsOptional()
  @IsString()
  category_type?: string; // 'PRODUCT' or 'SERVICE'
  // ====================================================================
}
