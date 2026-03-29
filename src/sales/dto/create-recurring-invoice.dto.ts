import { IsUUID, IsEnum, IsDate, IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringFrequency } from '../entities/recurring-invoice.entity';

export class CreateRecurringInvoiceDto {
  @IsUUID()
  client_id: string;

  @IsString()
  description: string;

  @IsEnum(RecurringFrequency)
  frequency: RecurringFrequency;

  @IsDate()
  @Type(() => Date)
  start_date: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  end_date?: Date;

  @IsNumber()
  amount: number;

  @IsNumber()
  @IsOptional()
  tax_rate?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
