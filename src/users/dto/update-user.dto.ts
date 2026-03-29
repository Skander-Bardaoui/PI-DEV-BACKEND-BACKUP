// src/users/dto/update-user.dto.ts
import { IsEmail, IsString, IsBoolean, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Role } from '../enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;
}