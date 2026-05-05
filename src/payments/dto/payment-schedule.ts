import { z } from 'zod';
import { PaymentMethod } from '../enums/payment-method.enum';

const InstallmentLineSchema = z.object({
  due_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  amount:         z.number().positive(),
  payment_method: z.nativeEnum(PaymentMethod),
  reference:      z.string().max(100).nullable().optional(),
  notes:          z.string().nullable().optional(),
});

export const CreatePaymentScheduleSchema = z.object({
  purchase_invoice_id: z.string().uuid(),
  notes:               z.string().nullable().optional(),
  installments:        z.array(InstallmentLineSchema).min(2, 'At least 2 installments'),
});

export const PayInstallmentSchema = z.object({
  account_id:     z.string().uuid(),
  payment_method: z.nativeEnum(PaymentMethod),
  paid_at:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference:      z.string().max(100).nullable().optional(),
  notes:          z.string().nullable().optional(),
});

export type CreatePaymentScheduleDto = z.infer<typeof CreatePaymentScheduleSchema>;
export type PayInstallmentDto        = z.infer<typeof PayInstallmentSchema>;
