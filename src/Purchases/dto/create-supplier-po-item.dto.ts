import { Type } from 'class-transformer';
import { IsUUID, IsDate, IsArray, ArrayMinSize, ArrayMaxSize, IsInt, IsPositive, IsOptional, IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max, ValidateNested } from 'class-validator';
 
export class CreateSupplierPOItemDto {
  @IsOptional() @IsUUID() product_id?: string;
 
  @IsString()
  @IsNotEmpty({ message: 'La description de la ligne est obligatoire' })
  @MaxLength(500)
  description: string;
 
  @IsNumber({}, { message: 'La quantité doit être un nombre' })
  @IsPositive({ message: 'La quantité doit être positive' })
  quantity_ordered: number;
 
  @IsNumber({}, { message: 'Le prix unitaire doit être un nombre' })
  @Min(0, { message: 'Le prix unitaire ne peut pas être négatif' })
  unit_price_ht: number;
 
  @IsNumber()
  @Min(0) @Max(100)
  tax_rate_value: number;
 
  @IsOptional()
  @IsInt() @Min(0)
  sort_order?: number;
}
 
