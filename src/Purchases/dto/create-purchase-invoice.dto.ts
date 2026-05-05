import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreatePurchaseInvoiceDto {
  @IsOptional()
  @IsString({ message: 'Le numéro de facture doit être une chaîne de caractères' })
  @MaxLength(100, { message: 'Le numéro de facture ne peut pas dépasser 100 caractères' })
  invoice_number_supplier?: string;
 
  @IsUUID('4', { message: 'Fournisseur invalide' })
  @IsNotEmpty({ message: 'Le fournisseur est obligatoire' })
  supplier_id: string;
 
  @IsOptional()
  @IsUUID('4', { message: 'Bon de commande invalide' })
  supplier_po_id?: string;
 
  @IsString({ message: 'La date de facture doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La date de facture est obligatoire' })
  invoice_date: string;
 
  @IsOptional()
  @IsString({ message: 'La date d\'échéance doit être une chaîne de caractères' })
  due_date?: string;
 
  @IsNumber({}, { message: 'Le sous-total HT doit être un nombre' })
  @Min(0, { message: 'Le sous-total HT ne peut pas être négatif' })
  @Max(99999999.999, { message: 'Le sous-total HT ne peut pas dépasser 99999999.999 TND' })
  subtotal_ht: number;
 
  @IsNumber({}, { message: 'La TVA doit être un nombre' })
  @Min(0, { message: 'La TVA ne peut pas être négative' })
  @Max(99999999.999, { message: 'La TVA ne peut pas dépasser 99999999.999 TND' })
  tax_amount: number;
 
  @IsOptional()
  @IsNumber({}, { message: 'Le timbre fiscal doit être un nombre' })
  @Min(0, { message: 'Le timbre fiscal ne peut pas être négatif' })
  @Max(10.000, { message: 'Le timbre fiscal ne peut pas dépasser 10.000 TND' })
  timbre_fiscal?: number;
 
  @IsOptional()
  @IsNumber({}, { message: 'Le montant net doit être un nombre' })
  @Min(0, { message: 'Le montant net ne peut pas être négatif' })
  @Max(99999999.999, { message: 'Le montant net ne peut pas dépasser 99999999.999 TND' })
  net_amount?: number;
 
  @IsOptional()
  @IsString()
  receipt_url?: string;
}