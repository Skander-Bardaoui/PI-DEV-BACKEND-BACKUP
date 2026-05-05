import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateDeliveryNoteItemDto {
  @IsNotEmpty({ message: 'Le produit est obligatoire' })
  @IsUUID('4', { message: 'Produit invalide' })
  productId: string;

  @IsNotEmpty({ message: 'La description est obligatoire' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'La quantité est obligatoire' })
  @IsNumber({}, { message: 'La quantité doit être un nombre' })
  @Min(0.01, { message: 'La quantité doit être supérieure à 0' })
  quantity: number;

  @IsNotEmpty({ message: 'La quantité livrée est obligatoire' })
  @IsNumber({}, { message: 'La quantité livrée doit être un nombre' })
  @Min(0, { message: 'La quantité livrée doit être positive' })
  deliveredQuantity: number;
}
