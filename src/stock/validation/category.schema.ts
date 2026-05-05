import { z } from 'zod';

// Category Type Enum
export const CategoryTypeSchema = z.enum(['PRODUCT', 'SERVICE']);

// Create Category Schema
export const CreateCategorySchema = z.object({
  name: z.string()
    .min(1, 'Le nom de la catégorie est requis')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .trim(),
  
  description: z.string()
    .max(1000, 'La description ne peut pas dépasser 1000 caractères')
    .trim()
    .optional()
    .nullable(),
  
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'La couleur doit être au format hexadécimal (#RRGGBB)')
    .optional()
    .nullable(),
  
  icon: z.string()
    .max(100, 'L\'icône ne peut pas dépasser 100 caractères')
    .trim()
    .optional()
    .nullable(),
  
  is_active: z.boolean()
    .optional()
    .nullable(),
  
  category_type: CategoryTypeSchema
    .optional()
    .nullable()
    .default('PRODUCT'),
});

// Update Category Schema (all fields optional)
export const UpdateCategorySchema = CreateCategorySchema.partial();

// Query Categories Schema
export const QueryCategoriesSchema = z.object({
  search: z.string()
    .max(255, 'La recherche ne peut pas dépasser 255 caractères')
    .trim()
    .optional(),
  
  is_active: z.boolean()
    .optional(),
  
  category_type: CategoryTypeSchema
    .optional(),
});

// Type exports
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type QueryCategoriesInput = z.infer<typeof QueryCategoriesSchema>;
