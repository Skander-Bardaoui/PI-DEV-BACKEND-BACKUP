import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';
import { InvoiceType } from '../entities/invoice.entity';

export class CreateInvoiceDto {
  @IsUUID('4', { message: 'Client invalide' })
  @IsNotEmpty({ message: 'Le client est obligatoire' })
  client_id: string;

  @IsOptional()
  @IsEnum(InvoiceType, { message: 'Type de facture invalide' })
  type?: InvoiceType;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  due_date?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Commande invalide' })
  purchase_order_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Devis invalide' })
  quote_id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Facture originale invalide' })
  original_invoice_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'La facture doit contenir au moins une ligne' })
  @ArrayMaxSize(100, { message: 'La facture ne peut pas dépasser 100 lignes' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
