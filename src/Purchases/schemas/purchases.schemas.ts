import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const amountTND = (label: string) =>
  z.coerce
    .number()
    .min(0, `${label} ne peut pas être négatif`)
    .max(99999999.999, `${label} ne peut pas dépasser 99999999.999 TND`)
    .multipleOf(0.001, `${label} doit avoir au maximum 3 décimales`);

const optionalString = z.string().trim().optional().or(z.literal(''));

const tunisianPhone = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s\-().]{8,20}$/, 'Numéro de téléphone invalide (ex: +216 71 000 000)')
  .optional()
  .or(z.literal(''));

// Validation de date ISO avec vérifications avancées
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
  .refine((date) => {
    if (!date) return true; // Optionnel
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Date invalide (jour/mois incorrect)')
  .refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    const year = parsed.getFullYear();
    return year >= 1900 && year <= 2100;
  }, 'L\'année doit être entre 1900 et 2100')
  .optional()
  .or(z.literal(''));

// Date obligatoire avec validations
const requiredIsoDate = z
  .string()
  .trim()
  .min(1, 'La date est obligatoire')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Date invalide (jour/mois incorrect)')
  .refine((date) => {
    const parsed = new Date(date);
    const year = parsed.getFullYear();
    return year >= 1900 && year <= 2100;
  }, 'L\'année doit être entre 1900 et 2100');

// Date future obligatoire (pour livraisons, échéances)
const requiredFutureDate = z
  .string()
  .trim()
  .min(1, 'La date est obligatoire')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Date invalide (jour/mois incorrect)')
  .refine((date) => {
    const parsed = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed >= today;
  }, 'La date doit être supérieure ou égale à aujourd\'hui');

// Date future optionnelle (pour livraisons, échéances)
const optionalFutureDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Date invalide (jour/mois incorrect)')
  .refine((date) => {
    const parsed = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed >= today;
  }, 'La date doit être supérieure ou égale à aujourd\'hui')
  .optional()
  .or(z.literal(''));
const futureDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
  .refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Date invalide (jour/mois incorrect)')
  .refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed >= today;
  }, 'La date doit être supérieure ou égale à aujourd\'hui')
  .optional()
  .or(z.literal(''));

// Date passée ou aujourd'hui (pour factures, réceptions)
const pastOrTodayDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
  .refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Date invalide (jour/mois incorrect)')
  .refine((date) => {
    if (!date) return true;
    const parsed = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return parsed <= today;
  }, 'La date ne peut pas être dans le futur')
  .optional()
  .or(z.literal(''));

// ══════════════════════════════════════════════════════════════════════════════
// 1. FOURNISSEUR
// ══════════════════════════════════════════════════════════════════════════════
const addressSchema = z.object({
  street: z
    .string()
    .trim()
    .min(1, 'La rue est obligatoire')
    .max(200, 'La rue ne peut pas dépasser 200 caractères'),
  city: z
    .string()
    .trim()
    .min(1, 'La ville est obligatoire')
    .max(100, 'La ville ne peut pas dépasser 100 caractères'),
  postal_code: z
    .string()
    .trim()
    .min(1, 'Le code postal est obligatoire')
    .regex(/^[\d\s-]{4,10}$/, 'Code postal invalide (4-10 chiffres)'),
  country: z
    .string()
    .trim()
    .min(1, 'Le pays est obligatoire')
    .max(100, 'Le pays ne peut pas dépasser 100 caractères')
    .default('Tunisie'),
});

export const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est obligatoire')
    .max(200, 'Le nom ne peut pas dépasser 200 caractères')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s\-&'.()]+$/, 'Le nom contient des caractères invalides'),

  matricule_fiscal: z
    .string()
    .trim()
    .min(1, 'Le matricule fiscal est obligatoire')
    .regex(/^[\d]{7}\/[A-Z]\/[A-Z]\/[A-Z]\/[\d]{3}$/, 'Format invalide (ex: 1234567/A/B/C/000)')
    .max(30, 'Matricule fiscal trop long'),

  email: z
    .string()
    .trim()
    .min(1, 'L\'email est obligatoire')
    .email('Adresse email invalide'),

  phone: z
    .string()
    .trim()
    .min(1, 'Le téléphone est obligatoire')
    .regex(/^[+]?[\d\s\-().]{8,20}$/, 'Numéro de téléphone invalide (ex: +216 71 000 000)'),

  address: addressSchema,

  rib: z
    .string()
    .trim()
    .min(1, 'Le RIB est obligatoire')
    .regex(/^[\d\s]{20,30}$/, 'RIB invalide (20-30 chiffres)')
    .max(30, 'RIB trop long'),

  bank_name: z
    .string()
    .trim()
    .min(1, 'Le nom de banque est obligatoire')
    .max(100, 'Nom de banque trop long')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s\-&'.]+$/, 'Le nom de banque contient des caractères invalides'),

  payment_terms: z.coerce
    .number()
    .int('Le délai doit être un nombre entier')
    .min(0, 'Le délai ne peut pas être négatif')
    .max(365, 'Le délai ne peut pas dépasser 365 jours')
    .default(30),

  category: z
    .string()
    .trim()
    .min(1, 'La catégorie est obligatoire')
    .max(100, 'Catégorie trop longue')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s\-&',]+$/, 'La catégorie contient des caractères invalides'),

  notes: z
    .string()
    .trim()
    .max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères')
    .optional()
    .or(z.literal('')),
});

export class CreateSupplierDto extends createZodDto(createSupplierSchema) {}

export const updateSupplierSchema = createSupplierSchema.partial();
export class UpdateSupplierDto extends createZodDto(updateSupplierSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 2. BON DE COMMANDE
// ══════════════════════════════════════════════════════════════════════════════
export const createSupplierPOItemSchema = z.object({
  product_id: z
    .string()
    .uuid('Produit invalide')
    .min(1, 'Le produit est obligatoire pour le suivi des stocks'), // ✅ Made REQUIRED

  description: z
    .string()
    .trim()
    .min(1, 'La description est obligatoire')
    .max(500, 'Description trop longue'),

  quantity_ordered: z.coerce
    .number()
    .positive('La quantité doit être supérieure à 0')
    .max(999999.999, 'La quantité ne peut pas dépasser 999999.999')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),

  unit_price_ht: z.coerce
    .number()
    .positive('Le prix unitaire doit être supérieur à 0')
    .max(9999999.999, 'Le prix unitaire ne peut pas dépasser 9999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),

  tax_rate_value: z.coerce
    .number()
    .min(0, 'Le taux de TVA ne peut pas être négatif')
    .max(100, 'Le taux de TVA ne peut pas dépasser 100%'),

  sort_order: z.coerce
    .number()
    .int('L\'ordre de tri doit être un nombre entier')
    .min(0, 'L\'ordre de tri ne peut pas être négatif')
    .optional(),
});

export class CreateSupplierPOItemDto extends createZodDto(createSupplierPOItemSchema) {}

export const createSupplierPOSchema = z.object({
  supplier_id: z
    .string()
    .uuid('Fournisseur invalide')
    .min(1, 'Le fournisseur est obligatoire'),

  expected_delivery: optionalFutureDate,

  notes: z
    .string()
    .trim()
    .max(1000, 'Notes trop longues')
    .optional()
    .or(z.literal('')),

  items: z
    .array(createSupplierPOItemSchema)
    .min(1, 'Le bon de commande doit contenir au moins une ligne')
    .max(100, 'Maximum 100 lignes par bon de commande'),

  ml_product_id: z
    .string()
    .uuid('ID produit ML invalide')
    .optional(),
});

export class CreateSupplierPODto extends createZodDto(createSupplierPOSchema) {}

export const updateSupplierPOSchema = z.object({
  expected_delivery: isoDate,
  notes: optionalString,
  items: z.array(createSupplierPOItemSchema).min(1).max(100).optional(),
});

export class UpdateSupplierPODto extends createZodDto(updateSupplierPOSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 3. BON DE RÉCEPTION
// ══════════════════════════════════════════════════════════════════════════════
export const createGoodsReceiptItemSchema = z.object({
  supplier_po_item_id: z
    .string()
    .uuid('Ligne de BC invalide')
    .min(1, 'La ligne de BC est obligatoire'),

  quantity_received: z.coerce
    .number()
    .positive('La quantité reçue doit être positive')
    .max(999999.999, 'La quantité reçue ne peut pas dépasser 999999.999')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),
});

export class CreateGoodsReceiptItemDto extends createZodDto(createGoodsReceiptItemSchema) {}

// Schéma de base pour bon de réception avec date optionnelle
export const createGoodsReceiptSchema = z.object({
  receipt_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format attendu : YYYY-MM-DD)')
    .refine((date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }, 'Date invalide (jour/mois incorrect)')
    .refine((date) => {
      const parsed = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return parsed <= today;
    }, 'La date de réception ne peut pas être dans le futur')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .trim()
    .max(1000, 'Notes trop longues')
    .optional()
    .or(z.literal('')),

  items: z
    .array(createGoodsReceiptItemSchema)
    .min(1, 'Le bon de réception doit contenir au moins une ligne'),
});

export class CreateGoodsReceiptDto extends createZodDto(createGoodsReceiptSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 4. FACTURE FOURNISSEUR
// ══════════════════════════════════════════════════════════════════════════════
export const createPurchaseInvoiceSchema = z.object({
  invoice_number_supplier: z
    .string()
    .trim()
    .max(100, 'Numéro de facture trop long')
    .optional()
    .or(z.literal('')),

  supplier_id: z
    .string()
    .uuid('Fournisseur invalide')
    .min(1, 'Le fournisseur est obligatoire'),

  supplier_po_id: z
    .string()
    .uuid('Bon de commande invalide')
    .optional()
    .or(z.literal('')),

  invoice_date: requiredIsoDate,

  due_date: isoDate,

  subtotal_ht: z.coerce
    .number()
    .min(0, 'Le sous-total HT ne peut pas être négatif')
    .max(99999999.999, 'Le sous-total HT ne peut pas dépasser 99999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),

  tax_amount: z.coerce
    .number()
    .min(0, 'La TVA ne peut pas être négative')
    .max(99999999.999, 'La TVA ne peut pas dépasser 99999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),
  
  timbre_fiscal: z.coerce
    .number()
    .min(0, 'Le timbre fiscal ne peut pas être négatif')
    .max(10.000, 'Le timbre fiscal ne peut pas dépasser 10.000 TND')
    .default(1.000),

  net_amount: z.coerce
    .number()
    .min(0, 'Le montant net ne peut pas être négatif')
    .max(99999999.999, 'Le montant net ne peut pas dépasser 99999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales')
    .optional(),

  receipt_url: z
    .string()
    .trim()
    .url('URL invalide')
    .max(500, 'URL trop longue')
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => {
    if (!data.due_date || !data.invoice_date) return true;
    const invoiceDate = new Date(data.invoice_date);
    const dueDate = new Date(data.due_date);
    return dueDate >= invoiceDate;
  },
  {
    message: 'La date d\'échéance doit être postérieure ou égale à la date de facture',
    path: ['due_date'],
  }
);

export class CreatePurchaseInvoiceDto extends createZodDto(createPurchaseInvoiceSchema) {}

// Pour l'update, on crée un schéma sans le refine, puis on applique partial
const basePurchaseInvoiceSchema = z.object({
  invoice_number_supplier: z
    .string()
    .trim()
    .min(1, 'Le numéro de facture est obligatoire')
    .max(100, 'Numéro de facture trop long'),

  supplier_id: z
    .string()
    .uuid('Fournisseur invalide')
    .min(1, 'Le fournisseur est obligatoire'),

  supplier_po_id: z
    .string()
    .uuid('Bon de commande invalide')
    .optional()
    .or(z.literal('')),

  invoice_date: requiredIsoDate,

  due_date: isoDate,

  subtotal_ht: z.coerce
    .number()
    .min(0, 'Le sous-total HT ne peut pas être négatif')
    .max(99999999.999, 'Le sous-total HT ne peut pas dépasser 99999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),

  tax_amount: z.coerce
    .number()
    .min(0, 'La TVA ne peut pas être négative')
    .max(99999999.999, 'La TVA ne peut pas dépasser 99999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales'),
  
  timbre_fiscal: z.coerce
    .number()
    .min(0, 'Le timbre fiscal ne peut pas être négatif')
    .max(10.000, 'Le timbre fiscal ne peut pas dépasser 10.000 TND')
    .default(1.000),

  net_amount: z.coerce
    .number()
    .min(0, 'Le montant net ne peut pas être négatif')
    .max(99999999.999, 'Le montant net ne peut pas dépasser 99999999.999 TND')
    .multipleOf(0.001, 'Précision maximale : 3 décimales')
    .optional(),

  receipt_url: z
    .string()
    .trim()
    .url('URL invalide')
    .max(500, 'URL trop longue')
    .optional()
    .or(z.literal('')),
});

export const updatePurchaseInvoiceSchema = basePurchaseInvoiceSchema.partial();
export class UpdatePurchaseInvoiceDto extends createZodDto(updatePurchaseInvoiceSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 5. LITIGE
// ══════════════════════════════════════════════════════════════════════════════
export const disputeInvoiceSchema = z.object({
  dispute_reason: z
    .string()
    .trim()
    .min(1, 'Le motif du litige est obligatoire')
    .max(500, 'Le motif ne peut pas dépasser 500 caractères'),
});

export class DisputeInvoiceDto extends createZodDto(disputeInvoiceSchema) {}

export const disputeResponseSchema = z.object({
  response_text: z
    .string()
    .trim()
    .min(1, 'La réponse est obligatoire')
    .max(2000, 'La réponse ne peut pas dépasser 2000 caractères'),

  proposed_resolution: z
    .enum(['accept_correction', 'partial_credit', 'full_refund', 'reject'])
    .optional(),

  proposed_amount: amountTND('Le montant proposé').optional(),
});

export class DisputeResponseDto extends createZodDto(disputeResponseSchema) {}

export const resolveDisputeSchema = z.object({
  resolution_type: z.enum(['accept_correction', 'partial_credit', 'full_refund', 'reject']),

  final_amount: amountTND('Le montant final'),

  resolution_notes: z
    .string()
    .trim()
    .max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères')
    .optional()
    .or(z.literal('')),
});

export class ResolveDisputeDto extends createZodDto(resolveDisputeSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 6. INVITATION FOURNISSEUR
// ══════════════════════════════════════════════════════════════════════════════
export const supplierInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'L\'email est obligatoire')
    .email('Adresse email invalide'),

  supplier_name: z
    .string()
    .trim()
    .min(1, 'Le nom du fournisseur est obligatoire')
    .max(200, 'Le nom ne peut pas dépasser 200 caractères'),

  message: z
    .string()
    .trim()
    .max(1000, 'Le message ne peut pas dépasser 1000 caractères')
    .optional()
    .or(z.literal('')),
});

export class SupplierInviteDto extends createZodDto(supplierInviteSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 7. GÉNÉRATION BC PAR IA
// ══════════════════════════════════════════════════════════════════════════════
export const aiPOGeneratorSchema = z.object({
  text: z
    .string()
    .max(5000, 'Le texte ne peut pas dépasser 5000 caractères')
    .optional()
    .or(z.literal('')),
});

export class AiPOGeneratorDto extends createZodDto(aiPOGeneratorSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 8. PAIEMENT
// ══════════════════════════════════════════════════════════════════════════════
export const updatePaymentAmountSchema = z.object({
  paid_amount: amountTND('Le montant payé'),
});

export class UpdatePaymentAmountDto extends createZodDto(updatePaymentAmountSchema) {}

// ══════════════════════════════════════════════════════════════════════════════
// 9. CRÉATION FACTURE DEPUIS BC
// ══════════════════════════════════════════════════════════════════════════════
export const createInvoiceFromPOSchema = z.object({
  invoice_number_supplier: z
    .string()
    .trim()
    .max(100, 'Numéro de facture trop long')
    .optional()
    .or(z.literal('')),

  invoice_date: requiredIsoDate,

  due_date: isoDate,

  receipt_url: z
    .string()
    .trim()
    .url('URL invalide')
    .max(500, 'URL trop longue')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .trim()
    .max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères')
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => {
    if (!data.due_date || !data.invoice_date) return true;
    const invoiceDate = new Date(data.invoice_date);
    const dueDate = new Date(data.due_date);
    return dueDate >= invoiceDate;
  },
  {
    message: 'La date d\'échéance doit être postérieure ou égale à la date de facture',
    path: ['due_date'],
  }
);

export class CreateInvoiceFromPODto extends createZodDto(createInvoiceFromPOSchema) {}