import { z } from 'zod';

// Stock Movement Type Enum
export const StockMovementTypeSchema = z.enum([
  'ENTREE_ACHAT',
  'SORTIE_VENTE',
  'AJUSTEMENT_POSITIF',
  'AJUSTEMENT_NEGATIF',
  'IN',
  'OUT',
  'ADJUSTMENT',
]);

// Create Stock Movement Schema
export const CreateStockMovementSchema = z.object({
  product_id: z.string()
    .uuid('ID de produit invalide'),
  
  type: StockMovementTypeSchema,
  
  quantity: z.number()
    .min(0.01, 'La quantité doit être supérieure à zéro')
    .max(999999999, 'La quantité est trop élevée')
    .finite('La quantité doit être un nombre valide'),
  
  source_type: z.string()
    .max(100, 'Le type de source ne peut pas dépasser 100 caractères')
    .trim()
    .optional()
    .nullable(),
  
  source_id: z.string()
    .uuid('ID de source invalide')
    .optional()
    .nullable(),
  
  warehouse_id: z.string()
    .uuid('ID d\'entrepôt invalide')
    .optional()
    .nullable(),
  
  note: z.string()
    .max(1000, 'La note ne peut pas dépasser 1000 caractères')
    .trim()
    .optional()
    .nullable(),
});

// Query Stock Movements Schema
export const QueryStockMovementsSchema = z.object({
  product_id: z.string()
    .uuid('ID de produit invalide')
    .optional(),
  
  type: StockMovementTypeSchema
    .optional(),
  
  start_date: z.string()
    .datetime('Date de début invalide')
    .optional(),
  
  end_date: z.string()
    .datetime('Date de fin invalide')
    .optional(),
  
  limit: z.number()
    .int('La limite doit être un nombre entier')
    .min(1, 'La limite doit être au moins 1')
    .max(1000, 'La limite ne peut pas dépasser 1000')
    .optional(),
  
  offset: z.number()
    .int('L\'offset doit être un nombre entier')
    .min(0, 'L\'offset doit être positif ou zéro')
    .optional(),
}).refine((data) => {
  // If both dates are provided, start_date should be before end_date
  if (data.start_date && data.end_date) {
    return new Date(data.start_date) <= new Date(data.end_date);
  }
  return true;
}, {
  message: 'La date de début doit être antérieure à la date de fin',
  path: ['start_date'],
});

// Type exports
export type CreateStockMovementInput = z.infer<typeof CreateStockMovementSchema>;
export type QueryStockMovementsInput = z.infer<typeof QueryStockMovementsSchema>;
