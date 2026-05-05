import { Type } from 'class-transformer';
import { IsUUID, IsDate, IsArray, ArrayMinSize, ArrayMaxSize, IsInt, IsPositive, IsOptional, IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max, ValidateNested } from 'class-validator';
 
export class CreateSupplierPOItemDto {
  @IsNotEmpty({ message: 'Le produit est obligatoire pour le suivi des stocks' })
  @IsUUID('4', { message: 'Produit invalide' }) 
  product_id: string; // ✅ Made REQUIRED
 
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La description de la ligne est obligatoire' })
  @MaxLength(500, { message: 'La description ne peut pas dépasser 500 caractères' })
  description: string;
 
  @IsNumber({}, { message: 'La quantité doit être un nombre' })
  @IsPositive({ message: 'La quantité doit être positive' })
  @Max(999999.999, { message: 'La quantité ne peut pas dépasser 999999.999' })
  quantity_ordered: number;
 
  @IsNumber({}, { message: 'Le prix unitaire doit être un nombre' })
  @Min(0, { message: 'Le prix unitaire ne peut pas être négatif' })
  @Max(9999999.999, { message: 'Le prix unitaire ne peut pas dépasser 9999999.999 TND' })
  unit_price_ht: number;
 
  @IsNumber({}, { message: 'Le taux de TVA doit être un nombre' })
  @Min(0, { message: 'Le taux de TVA ne peut pas être négatif' })
  @Max(100, { message: 'Le taux de TVA ne peut pas dépasser 100%' })
  tax_rate_value: number;
 
  @IsOptional()
  @IsInt({ message: 'L\'ordre de tri doit être un nombre entier' })
  @Min(0, { message: 'L\'ordre de tri ne peut pas être négatif' })
  sort_order?: number;
}
