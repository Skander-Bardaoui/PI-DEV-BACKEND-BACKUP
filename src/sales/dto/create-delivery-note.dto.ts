import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CreateDeliveryNoteItemDto } from './create-delivery-note-item.dto';

export class CreateDeliveryNoteDto {
  @IsUUID('4', { message: 'Client invalide' })
  @IsNotEmpty({ message: 'Le client est obligatoire' })
  clientId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Commande invalide' })
  salesOrderId?: string;

  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'Le bon de livraison doit contenir au moins une ligne' })
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryNoteItemDto)
  items: CreateDeliveryNoteItemDto[];
}
