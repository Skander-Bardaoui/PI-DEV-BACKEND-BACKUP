import { IsOptional, IsString, MaxLength } from "class-validator";

export class AiPOGeneratorDto {
  @IsOptional()
  @IsString({ message: 'Le texte doit être une chaîne de caractères' })
  @MaxLength(5000, { message: 'Le texte ne peut pas dépasser 5000 caractères' })
  text?: string;
}