// src/users/dto/update-profile.dto.ts
import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @IsIn(['fr', 'en', 'ar'])
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
