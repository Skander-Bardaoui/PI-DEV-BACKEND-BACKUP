import { z } from 'zod';

export const CreateTransferSchema = z.object({
  from_account_id: z.string().uuid('Invalid from_account_id'),
  to_account_id: z.string().uuid('Invalid to_account_id'),
  amount: z.number().positive('Amount must be positive'),
  transfer_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid transfer_date',
  }),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
}).refine((data) => data.from_account_id !== data.to_account_id, {
  message: 'Source and destination accounts must be different',
  path: ['to_account_id'],
});
