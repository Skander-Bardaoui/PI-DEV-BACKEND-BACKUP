import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SupplierInviteDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty({ message: 'L\'email est obligatoire' })
  email: string;

  @IsString({ message: 'Le nom du fournisseur doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom du fournisseur est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(200, { message: 'Le nom ne peut pas dépasser 200 caractères' })
  supplier_name: string;

  @IsOptional()
  @IsString({ message: 'Le message doit être une chaîne de caractères' })
  @MaxLength(1000, { message: 'Le message ne peut pas dépasser 1000 caractères' })
  message?: string;
}