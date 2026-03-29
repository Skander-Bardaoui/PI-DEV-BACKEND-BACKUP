// src/accounts/dto/create-account.dto.ts
import { z } from 'zod';
import { AccountType } from '../enums/account-type.enum';

export const CreateAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100),   // ← required
  type: z.nativeEnum(AccountType),                                 // ← required
  bank_name: z.string().max(100).optional(),
  rib: z.string().length(23).optional(),
  opening_balance: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('TND'),
  is_default: z.boolean().optional().default(false),
});

export type CreateAccountDto = z.infer<typeof CreateAccountSchema>;
