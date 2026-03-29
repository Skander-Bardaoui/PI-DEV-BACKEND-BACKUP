import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdatePurchaseInvoiceDto {
  @IsOptional() @IsString() @MaxLength(100) invoice_number_supplier?: string;
  @IsOptional() @IsString() invoice_date?: string;
  @IsOptional() @IsString() due_date?: string;
  @IsOptional() @IsNumber() @Min(0) subtotal_ht?: number;
  @IsOptional() @IsNumber() @Min(0) tax_amount?: number;
  @IsOptional() @IsNumber() @Min(0) timbre_fiscal?: number;
  @IsOptional() @IsString() receipt_url?: string;
}
 
export class DisputeInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Le motif du litige est obligatoire' })
  @MinLength(10, { message: 'Le motif doit contenir au moins 10 caractères' })
  @MaxLength(500)
  dispute_reason: string;
}
 
export class UpdatePaymentAmountDto {
  @IsNumber({}, { message: 'Le montant payé doit être un nombre' })
  @Min(0, { message: 'Le montant payé ne peut pas être négatif' })
  paid_amount: number;
}
 
export class QueryPurchaseInvoicesDto {
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() due_before?: string;
  @IsOptional() @IsString() date_from?: string;
  @IsOptional() @IsString() date_to?: string;
  @IsOptional() @IsString() sort_field?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sort_dir?: 'asc' | 'desc';
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsNumber() @Min(1)
  page?: number = 1;
 
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 20)
  @IsNumber() @Min(1) @Max(100)
  limit?: number = 20;
}