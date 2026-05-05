import { IsString, IsOptional } from 'class-validator';

export class GenerateSkuDto {
  @IsOptional()
  @IsString()
  category_name?: string | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsString()
  extra_attribute?: string | null;

  // ==================== Alaa change for service type ====================
  @IsOptional()
  @IsString()
  type?: 'PHYSICAL' | 'SERVICE' | 'DIGITAL';
  // ====================================================================
}

export class GenerateSkuResponseDto {
  sku: string;
}
