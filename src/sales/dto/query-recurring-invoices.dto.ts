import { IsOptional, IsEnum, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringFrequency, RecurringInvoiceStatus } from '../entities/recurring-invoice.entity';

export class QueryRecurringInvoicesDto {
  @IsOptional()
  @IsEnum(RecurringInvoiceStatus)
  status?: RecurringInvoiceStatus;

  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
