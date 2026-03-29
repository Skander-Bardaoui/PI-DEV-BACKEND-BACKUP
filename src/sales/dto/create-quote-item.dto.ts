import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateQuoteItemDto {
  @IsOptional()
  @IsUUID('4', { message: 'Produit invalide' })
  productId?: string;

  @IsNotEmpty({ message: 'La description est obligatoire' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'La quantité est obligatoire' })
  @IsNumber({}, { message: 'La quantité doit être un nombre' })
  @Min(0.01, { message: 'La quantité doit être supérieure à 0' })
  quantity: number;

  @IsNotEmpty({ message: 'Le prix unitaire est obligatoire' })
  @IsNumber({}, { message: 'Le prix unitaire doit être un nombre' })
  @Min(0, { message: 'Le prix unitaire doit être positif' })
  unitPrice: number;

  @IsNotEmpty({ message: 'Le taux de taxe est obligatoire' })
  @IsNumber({}, { message: 'Le taux de taxe doit être un nombre' })
  @Min(0, { message: 'Le taux de taxe doit être positif' })
  taxRate: number;
}
