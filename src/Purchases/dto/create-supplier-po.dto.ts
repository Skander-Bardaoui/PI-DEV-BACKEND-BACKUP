import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { CreateSupplierPOItemDto } from "./create-supplier-po-item.dto";
import { Type } from "class-transformer";

export class CreateSupplierPODto {
  @IsUUID('4', { message: 'Fournisseur invalide' })
  @IsNotEmpty({ message: 'Le fournisseur est obligatoire' })
  supplier_id: string;
 
  @IsOptional()
  @IsString()
  expected_delivery?: string;
 
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
 
  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'Le bon de commande doit contenir au moins une ligne' })
  @ArrayMaxSize(100, { message: 'Le bon de commande ne peut pas dépasser 100 lignes' })
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierPOItemDto)
  items: CreateSupplierPOItemDto[];

  // ID du produit ML pour tracking (optionnel)
  @IsOptional()
  @IsUUID('4')
  ml_product_id?: string;
}