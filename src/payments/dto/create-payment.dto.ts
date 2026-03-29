import { z } from 'zod';
import { PaymentMethod } from '../enums/payment-method.enum';

export const CreatePaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice_id'),
  account_id: z.string().uuid('Invalid account_id'),
  amount: z.number().positive('Amount must be positive'),
  payment_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid payment_date',
  }),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
});
