import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CreateQuoteItemDto } from './create-quote-item.dto';

export class CreateQuoteDto {
  @IsUUID('4', { message: 'Client invalide' })
  @IsNotEmpty({ message: 'Le client est obligatoire' })
  clientId: string;

  @IsOptional()
  @IsString()
  quoteDate?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'Le devis doit contenir au moins une ligne' })
  @ArrayMaxSize(100, { message: 'Le devis ne peut pas dépasser 100 lignes' })
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];
}
