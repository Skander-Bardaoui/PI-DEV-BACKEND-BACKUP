import { z } from 'zod';

// Create Warehouse Schema
export const CreateWarehouseSchema = z.object({
  name: z.string()
    .min(1, 'Le nom de l\'entrepôt est requis')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .trim(),
  
  code: z.string()
    .min(1, 'Le code de l\'entrepôt est requis')
    .max(50, 'Le code ne peut pas dépasser 50 caractères')
    .trim()
    .regex(/^[A-Z0-9-_]+$/, 'Le code doit contenir uniquement des lettres majuscules, chiffres, tirets et underscores'),
  
  description: z.string()
    .max(1000, 'La description ne peut pas dépasser 1000 caractères')
    .trim()
    .optional()
    .nullable(),
  
  address: z.string()
    .max(500, 'L\'adresse ne peut pas dépasser 500 caractères')
    .trim()
    .optional()
    .nullable(),
  
  latitude: z.number()
    .min(-90, 'La latitude doit être entre -90 et 90')
    .max(90, 'La latitude doit être entre -90 et 90')
    .finite('La latitude doit être un nombre valide')
    .optional()
    .nullable(),
  
  longitude: z.number()
    .min(-180, 'La longitude doit être entre -180 et 180')
    .max(180, 'La longitude doit être entre -180 et 180')
    .finite('La longitude doit être un nombre valide')
    .optional()
    .nullable(),
  
  is_active: z.boolean()
    .optional()
    .nullable(),
}).refine((data) => {
  // If latitude is provided, longitude must also be provided and vice versa
  const hasLatitude = data.latitude !== null && data.latitude !== undefined;
  const hasLongitude = data.longitude !== null && data.longitude !== undefined;
  
  if (hasLatitude !== hasLongitude) {
    return false;
  }
  return true;
}, {
  message: 'La latitude et la longitude doivent être fournies ensemble',
  path: ['latitude'],
});

// Update Warehouse Schema (all fields optional)
export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

// Type exports
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>;
