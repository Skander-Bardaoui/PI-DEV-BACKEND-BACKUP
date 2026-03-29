import { PartialType } from '@nestjs/mapped-types';
import { CreateRecurringInvoiceDto } from './create-recurring-invoice.dto';

export class UpdateRecurringInvoiceDto extends PartialType(CreateRecurringInvoiceDto) {}
