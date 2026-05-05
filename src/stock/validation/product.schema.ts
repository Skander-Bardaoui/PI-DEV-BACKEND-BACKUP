import { z } from 'zod';

// Product Type Enum
export const ProductTypeSchema = z.enum(['PHYSICAL', 'SERVICE', 'DIGITAL']);

// Create Product Schema
export const CreateProductSchema = z.object({
  name: z.string()
    .min(1, 'Le nom du produit est requis')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .trim(),
  
  sku: z.string()
    .min(1, 'La référence (SKU) est requise')
    .max(100, 'La référence ne peut pas dépasser 100 caractères')
    .trim()
    .regex(/^[A-Z0-9-_]+$/, 'La référence doit contenir uniquement des lettres majuscules, chiffres, tirets et underscores'),
  
  description: z.string()
    .max(1000, 'La description ne peut pas dépasser 1000 caractères')
    .trim()
    .optional()
    .nullable(),
  
  price: z.number()
    .min(0, 'Le prix doit être positif ou zéro')
    .max(999999999.99, 'Le prix est trop élevé')
    .finite('Le prix doit être un nombre valide'),
  
  cost: z.number()
    .min(0, 'Le coût doit être positif ou zéro')
    .max(999999999.99, 'Le coût est trop élevé')
    .finite('Le coût doit être un nombre valide')
    .optional()
    .nullable(),
  
  quantity: z.number()
    .min(0, 'La quantité doit être positive ou zéro')
    .max(999999999, 'La quantité est trop élevée')
    .finite('La quantité doit être un nombre valide')
    .optional()
    .nullable(),
  
  min_quantity: z.number()
    .min(0, 'La quantité minimale doit être positive ou zéro')
    .max(999999999, 'La quantité minimale est trop élevée')
    .finite('La quantité minimale doit être un nombre valide')
    .optional()
    .nullable(),
  
  category_id: z.string()
    .uuid('ID de catégorie invalide')
    .optional()
    .nullable(),
  
  default_supplier_id: z.string()
    .uuid('ID de fournisseur invalide')
    .optional()
    .nullable(),
  
  warehouse_id: z.string()
    .uuid('ID d\'entrepôt invalide')
    .optional()
    .nullable(),
  
  unit: z.string()
    .max(50, 'L\'unité ne peut pas dépasser 50 caractères')
    .trim()
    .optional()
    .nullable(),
  
  barcode: z.string()
    .max(100, 'Le code-barres ne peut pas dépasser 100 caractères')
    .trim()
    .optional()
    .nullable(),
  
  weight: z.number()
    .min(0, 'Le poids doit être positif ou zéro')
    .max(999999.99, 'Le poids est trop élevé')
    .finite('Le poids doit être un nombre valide')
    .optional()
    .nullable(),
  
  tax_rate: z.number()
    .min(0, 'Le taux de TVA doit être positif ou zéro')
    .max(100, 'Le taux de TVA ne peut pas dépasser 100%')
    .finite('Le taux de TVA doit être un nombre valide')
    .optional()
    .nullable(),
  
  track_inventory: z.boolean()
    .optional()
    .nullable(),
  
  type: ProductTypeSchema
    .optional()
    .nullable(),
  
  is_active: z.boolean()
    .optional()
    .nullable(),
  
  image_url: z.string()
    .url('URL d\'image invalide')
    .max(500, 'L\'URL de l\'image ne peut pas dépasser 500 caractères')
    .optional()
    .nullable(),
}).refine((data) => {
  // If cost is provided, it should not exceed price
  if (data.cost !== null && data.cost !== undefined && data.price !== null && data.price !== undefined) {
    return data.cost <= data.price;
  }
  return true;
}, {
  message: 'Le coût ne peut pas dépasser le prix de vente',
  path: ['cost'],
}).refine((data) => {
  // If min_quantity is provided, it should not exceed quantity
  if (data.min_quantity !== null && data.min_quantity !== undefined && 
      data.quantity !== null && data.quantity !== undefined) {
    return data.min_quantity <= data.quantity;
  }
  return true;
}, {
  message: 'La quantité minimale ne peut pas dépasser la quantité actuelle',
  path: ['min_quantity'],
});

// Update Product Schema (all fields optional)
export const UpdateProductSchema = CreateProductSchema.partial();

// Query Products Schema
export const QueryProductsSchema = z.object({
  search: z.string()
    .max(255, 'La recherche ne peut pas dépasser 255 caractères')
    .trim()
    .optional(),
  
  category_id: z.string()
    .uuid('ID de catégorie invalide')
    .optional(),
  
  is_active: z.boolean()
    .optional(),
  
  low_stock: z.boolean()
    .optional(),
  
  type: ProductTypeSchema
    .optional(),
});

// Generate SKU Schema
export const GenerateSkuSchema = z.object({
  category_name: z.string()
    .max(100, 'Le nom de catégorie ne peut pas dépasser 100 caractères')
    .trim()
    .optional()
    .nullable(),
  
  brand: z.string()
    .max(100, 'La marque ne peut pas dépasser 100 caractères')
    .trim()
    .optional()
    .nullable(),
  
  name: z.string()
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .trim()
    .optional()
    .nullable(),
  
  unit: z.string()
    .max(50, 'L\'unité ne peut pas dépasser 50 caractères')
    .trim()
    .optional()
    .nullable(),
  
  extra_attribute: z.string()
    .max(100, 'L\'attribut supplémentaire ne peut pas dépasser 100 caractères')
    .trim()
    .optional()
    .nullable(),
  
  type: ProductTypeSchema
    .optional()
    .nullable(),
});

// Bulk Labels Schema
export const BulkLabelsSchema = z.object({
  product_ids: z.array(z.string().uuid('ID de produit invalide'))
    .min(1, 'Au moins un produit doit être sélectionné')
    .max(100, 'Vous ne pouvez pas générer plus de 100 étiquettes à la fois'),
});

// Scan Service Description Schema
export const ScanServiceDescriptionSchema = z.object({
  description: z.string()
    .min(10, 'La description doit contenir au moins 10 caractères')
    .max(1000, 'La description ne peut pas dépasser 1000 caractères')
    .trim(),
});

// Type exports
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type QueryProductsInput = z.infer<typeof QueryProductsSchema>;
export type GenerateSkuInput = z.infer<typeof GenerateSkuSchema>;
export type BulkLabelsInput = z.infer<typeof BulkLabelsSchema>;
export type ScanServiceDescriptionInput = z.infer<typeof ScanServiceDescriptionSchema>;
