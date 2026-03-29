import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CreateSalesOrderItemDto } from './create-sales-order-item.dto';

export class CreateSalesOrderDto {
  @IsUUID('4', { message: 'Client invalide' })
  @IsNotEmpty({ message: 'Le client est obligatoire' })
  clientId: string;

  @IsOptional()
  @IsString()
  orderDate?: string;

  @IsOptional()
  @IsString()
  expectedDelivery?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Devis invalide' })
  quoteId?: string;

  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'La commande doit contenir au moins une ligne' })
  @ArrayMaxSize(100, { message: 'La commande ne peut pas dépasser 100 lignes' })
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderItemDto)
  items: CreateSalesOrderItemDto[];
}
