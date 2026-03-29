import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreatePurchaseInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de facture fournisseur est obligatoire' })
  @MaxLength(100)
  invoice_number_supplier: string;
 
  @IsUUID('4', { message: 'Fournisseur invalide' })
  supplier_id: string;
 
  @IsOptional()
  @IsUUID('4')
  supplier_po_id?: string;
 
  @IsString()
  @IsNotEmpty({ message: 'La date de facture est obligatoire' })
  invoice_date: string;
 
  @IsOptional()
  @IsString()
  due_date?: string;
 
  @IsNumber({}, { message: 'Le sous-total HT doit être un nombre' })
  @Min(0)
  subtotal_ht: number;
 
  @IsNumber({}, { message: 'La TVA doit être un nombre' })
  @Min(0)
  tax_amount: number;
 
  @IsOptional()
  @IsNumber()
  @Min(0)
  timbre_fiscal?: number;
 
  @IsOptional()
  @IsNumber()
  @Min(0)
  net_amount?: number;
 
  @IsOptional()
  @IsString()
  receipt_url?: string;
}