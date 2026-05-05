import { IsUUID, IsEnum, IsDate, IsNumber, IsString, IsOptional, IsBoolean, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { RecurringFrequency, DiscountType } from '../entities/recurring-invoice.entity';

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

  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @ValidateIf(o => o.discount_type != null)
  @IsNumber()
  @Min(0)
  discount_value?: number;
}
