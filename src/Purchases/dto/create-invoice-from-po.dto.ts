import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateInvoiceFromPODto {
  @IsOptional()
  @IsString({ message: 'Le numéro de facture doit être une chaîne de caractères' })
  @MaxLength(100, { message: 'Le numéro de facture ne peut pas dépasser 100 caractères' })
  invoice_number_supplier?: string;

  @IsString({ message: 'La date de facture doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La date de facture est obligatoire' })
  invoice_date: string;

  @IsOptional()
  @IsString({ message: 'La date d\'échéance doit être une chaîne de caractères' })
  due_date?: string;

  @IsOptional()
  @IsString({ message: 'L\'URL du reçu doit être une chaîne de caractères' })
  @MaxLength(500, { message: 'L\'URL du reçu ne peut pas dépasser 500 caractères' })
  receipt_url?: string;

  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
  @MaxLength(1000, { message: 'Les notes ne peuvent pas dépasser 1000 caractères' })
  notes?: string;
}