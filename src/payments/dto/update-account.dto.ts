// src/accounts/dto/update-account.dto.ts
import { z } from 'zod';
import { CreateAccountSchema } from './create-account.dto';

export const UpdateAccountSchema = CreateAccountSchema
  .partial()
  .extend({
    current_balance: z.number().min(0).optional(), // ← allow updating current_balance directly
  });

export type UpdateAccountDto = z.infer<typeof UpdateAccountSchema>;
