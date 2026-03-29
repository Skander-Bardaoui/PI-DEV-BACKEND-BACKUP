import { IsString, IsOptional } from 'class-validator';

export class RejectQuoteDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
