import {
  IsString, IsEmail, IsOptional, IsNumber, IsBoolean,
  IsNotEmpty, MinLength, MaxLength, Min, Max,
  ValidateNested, IsObject, Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
 
export class AddressDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() postal_code?: string;
  @IsOptional() @IsString() country?: string;
}
 
export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du fournisseur est obligatoire' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(200, { message: 'Le nom ne peut pas dépasser 200 caractères' })
  name: string;
 
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{7}[A-Z]\/[A-Z]\/[A-Z]\/[0-9]{3}$|^.{5,30}$/, {
    message: 'Format matricule fiscal invalide',
  })
  matricule_fiscal?: string;
 
  @IsOptional()
  @IsEmail({}, { message: 'Adresse email invalide' })
  email?: string;
 
  @IsOptional()
  @IsString()
  @Matches(/^[+]?[\d\s\-().]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  phone?: string;
 
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
 
  @IsOptional()
  @IsString()
  rib?: string;
 
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;
 
  @IsOptional()
  @IsNumber({}, { message: 'Le délai de paiement doit être un nombre' })
  @Min(0, { message: 'Le délai de paiement ne peut pas être négatif' })
  @Max(365, { message: 'Le délai de paiement ne peut pas dépasser 365 jours' })
  payment_terms?: number;
 
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
 
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
 