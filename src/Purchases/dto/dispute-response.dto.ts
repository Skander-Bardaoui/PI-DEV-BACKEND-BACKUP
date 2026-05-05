import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export enum ProposedResolution {
  ACCEPT_CORRECTION = 'accept_correction',
  PARTIAL_CREDIT = 'partial_credit',
  FULL_REFUND = 'full_refund',
  REJECT = 'reject',
}

export class DisputeResponseDto {
  @IsString({ message: 'La réponse doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La réponse est obligatoire' })
  @MinLength(10, { message: 'La réponse doit contenir au moins 10 caractères' })
  @MaxLength(2000, { message: 'La réponse ne peut pas dépasser 2000 caractères' })
  response_text: string;

  @IsOptional()
  @IsEnum(ProposedResolution, { message: 'Type de résolution invalide' })
  proposed_resolution?: ProposedResolution;

  @IsOptional()
  @IsNumber({}, { message: 'Le montant proposé doit être un nombre' })
  @Min(0, { message: 'Le montant proposé ne peut pas être négatif' })
  @Max(99999999.999, { message: 'Le montant proposé ne peut pas dépasser 99999999.999 TND' })
  proposed_amount?: number;
}

export class ResolveDisputeDto {
  @IsEnum(ProposedResolution, { message: 'Type de résolution invalide' })
  @IsNotEmpty({ message: 'Le type de résolution est obligatoire' })
  resolution_type: ProposedResolution;

  @IsNumber({}, { message: 'Le montant final doit être un nombre' })
  @Min(0, { message: 'Le montant final ne peut pas être négatif' })
  @Max(99999999.999, { message: 'Le montant final ne peut pas dépasser 99999999.999 TND' })
  final_amount: number;

  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
  @MaxLength(1000, { message: 'Les notes ne peuvent pas dépasser 1000 caractères' })
  resolution_notes?: string;
}