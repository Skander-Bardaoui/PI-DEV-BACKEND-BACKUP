import { IsEmail, IsString, IsOptional, IsArray } from 'class-validator';

export class SendQuoteDto {
  @IsEmail()
  to: string;

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  @IsString()
  @IsOptional()
  message?: string;
}
