// src/platform-auth/dto/platform-login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class PlatformTotpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  code!: string;
}

export class PlatformEnableTotpDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

export class PlatformSeedDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
