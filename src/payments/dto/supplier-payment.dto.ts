import { z } from 'zod';
import { PaymentMethod } from '../../payments/enums/payment-method.enum';

export const CreateSupplierPaymentSchema = z.object({
  supplier_id: z.string().uuid('Invalid supplier_id'),
  purchase_invoice_id: z.string().uuid('Invalid purchase_invoice_id').optional(),
  account_id: z.string().uuid('Invalid account_id'),
  amount: z.number().positive('Amount must be positive'),
  payment_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid payment_date',
  }),
  payment_method: z.nativeEnum(PaymentMethod),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
});
