import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdatePurchaseInvoiceDto {
  @IsOptional() 
  @IsString({ message: 'Le numéro de facture doit être une chaîne de caractères' })
  @MaxLength(100, { message: 'Le numéro de facture ne peut pas dépasser 100 caractères' }) 
  invoice_number_supplier?: string;
  
  @IsOptional() 
  @IsString({ message: 'La date de facture doit être une chaîne de caractères' }) 
  invoice_date?: string;
  
  @IsOptional() 
  @IsString({ message: 'La date d\'échéance doit être une chaîne de caractères' }) 
  due_date?: string;
  
  @IsOptional() 
  @IsNumber({}, { message: 'Le sous-total HT doit être un nombre' }) 
  @Min(0, { message: 'Le sous-total HT ne peut pas être négatif' })
  @Max(99999999.999, { message: 'Le sous-total HT ne peut pas dépasser 99999999.999 TND' })
  subtotal_ht?: number;
  
  @IsOptional() 
  @IsNumber({}, { message: 'La TVA doit être un nombre' }) 
  @Min(0, { message: 'La TVA ne peut pas être négative' })
  @Max(99999999.999, { message: 'La TVA ne peut pas dépasser 99999999.999 TND' })
  tax_amount?: number;
  
  @IsOptional() 
  @IsNumber({}, { message: 'Le timbre fiscal doit être un nombre' }) 
  @Min(0, { message: 'Le timbre fiscal ne peut pas être négatif' })
  @Max(10.000, { message: 'Le timbre fiscal ne peut pas dépasser 10.000 TND' })
  timbre_fiscal?: number;
  
  @IsOptional() 
  @IsString({ message: 'L\'URL du reçu doit être une chaîne de caractères' })
  @MaxLength(500, { message: 'L\'URL du reçu ne peut pas dépasser 500 caractères' })
  receipt_url?: string;
}
 
export class DisputeInvoiceDto {
  @IsString({ message: 'Le motif du litige doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le motif du litige est obligatoire' })
  @MinLength(10, { message: 'Le motif doit contenir au moins 10 caractères' })
  @MaxLength(500, { message: 'Le motif ne peut pas dépasser 500 caractères' })
  dispute_reason: string;
}
 
export class UpdatePaymentAmountDto {
  @IsNumber({}, { message: 'Le montant payé doit être un nombre' })
  @Min(0, { message: 'Le montant payé ne peut pas être négatif' })
  @Max(99999999.999, { message: 'Le montant payé ne peut pas dépasser 99999999.999 TND' })
  paid_amount: number;
}
 
export class QueryPurchaseInvoicesDto {
  @IsOptional() 
  @IsUUID('4', { message: 'Fournisseur invalide' }) 
  supplier_id?: string;
  
  @IsOptional() 
  @IsString({ message: 'Le statut doit être une chaîne de caractères' }) 
  status?: string;
  
  @IsOptional() 
  @IsString({ message: 'La date limite doit être une chaîne de caractères' }) 
  due_before?: string;
  
  @IsOptional() 
  @IsString({ message: 'La date de début doit être une chaîne de caractères' }) 
  date_from?: string;
  
  @IsOptional() 
  @IsString({ message: 'La date de fin doit être une chaîne de caractères' }) 
  date_to?: string;
  
  @IsOptional() 
  @IsString({ message: 'Le champ de tri doit être une chaîne de caractères' }) 
  sort_field?: string;
  
  @IsOptional() 
  @IsIn(['asc', 'desc'], { message: 'La direction de tri doit être "asc" ou "desc"' }) 
  sort_dir?: 'asc' | 'desc';
  
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsNumber({}, { message: 'La page doit être un nombre' }) 
  @Min(1, { message: 'La page doit être au moins 1' })
  page?: number = 1;
 
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 20)
  @IsNumber({}, { message: 'La limite doit être un nombre' }) 
  @Min(1, { message: 'La limite doit être au moins 1' }) 
  @Max(100, { message: 'La limite ne peut pas dépasser 100' })
  limit?: number = 20;
}