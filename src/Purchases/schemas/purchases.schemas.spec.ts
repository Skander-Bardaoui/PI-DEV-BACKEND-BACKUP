import { describe, it, expect } from '@jest/globals';
import {
  createSupplierSchema,
  createSupplierPOSchema,
  createPurchaseInvoiceSchema,
  createGoodsReceiptSchema,
  disputeInvoiceSchema,
} from './purchases.schemas';

describe('Purchases Schemas Validation', () => {
  describe('createSupplierSchema', () => {
    it('devrait valider un fournisseur valide', () => {
      const validSupplier = {
        name: 'Test Supplier',
        matricule_fiscal: '1234567/A/B/C/000',
        email: 'test@test.com',
        phone: '+216 71 000 000',
        address: {
          street: '123 Avenue Habib Bourguiba',
          city: 'Tunis',
          postal_code: '1000',
          country: 'Tunisie',
        },
        rib: '12345678901234567890',
        bank_name: 'Banque de Tunisie',
        payment_terms: 30,
        category: 'Fournitures',
      };

      const result = createSupplierSchema.safeParse(validSupplier);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un nom vide', () => {
      const invalidSupplier = {
        name: '',
        matricule_fiscal: '1234567/A/B/C/000',
        email: 'test@example.com',
        phone: '+216 71 000 000',
        address: {
          street: '123 Avenue',
          city: 'Tunis',
          postal_code: '1000',
          country: 'Tunisie',
        },
        rib: '12345678901234567890',
        bank_name: 'Banque Test',
        category: 'Test',
      };

      const result = createSupplierSchema.safeParse(invalidSupplier);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('obligatoire');
      }
    });

    it('devrait rejeter un email invalide', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        matricule_fiscal: '1234567/A/B/C/000',
        email: 'invalid-email',
        phone: '+216 71 000 000',
        address: {
          street: '123 Avenue',
          city: 'Tunis',
          postal_code: '1000',
          country: 'Tunisie',
        },
        rib: '12345678901234567890',
        bank_name: 'Banque Test',
        category: 'Test',
      };

      const result = createSupplierSchema.safeParse(invalidSupplier);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message.toLowerCase().includes('email'))).toBe(true);
      }
    });

    it('devrait rejeter un matricule fiscal invalide', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        matricule_fiscal: '123456', // Format invalide
        email: 'test@test.com',
        phone: '+216 71 000 000',
        address: {
          street: '123 Avenue',
          city: 'Tunis',
          postal_code: '1000',
          country: 'Tunisie',
        },
        rib: '12345678901234567890',
        bank_name: 'Banque Test',
        category: 'Test',
      };

      const result = createSupplierSchema.safeParse(invalidSupplier);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Format invalide');
      }
    });

    it('devrait rejeter un délai de paiement négatif', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        matricule_fiscal: '1234567/A/B/C/000',
        email: 'test@test.com',
        phone: '+216 71 000 000',
        address: {
          street: '123 Avenue',
          city: 'Tunis',
          postal_code: '1000',
          country: 'Tunisie',
        },
        rib: '12345678901234567890',
        bank_name: 'Banque Test',
        payment_terms: -10,
        category: 'Test',
      };

      const result = createSupplierSchema.safeParse(invalidSupplier);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ne peut pas être négatif');
      }
    });

    it('devrait rejeter un délai de paiement > 365 jours', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        matricule_fiscal: '1234567/A/B/C/000',
        email: 'test@test.com',
        phone: '+216 71 000 000',
        address: {
          street: '123 Avenue',
          city: 'Tunis',
          postal_code: '1000',
          country: 'Tunisie',
        },
        rib: '12345678901234567890',
        bank_name: 'Banque Test',
        payment_terms: 400,
        category: 'Test',
      };

      const result = createSupplierSchema.safeParse(invalidSupplier);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('365 jours');
      }
    });
  });

  describe('createSupplierPOSchema', () => {
    it('devrait valider un BC valide', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const validPO = {
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        expected_delivery: tomorrowStr,
        items: [
          {
            description: 'Produit test',
            quantity_ordered: 10,
            unit_price_ht: 100.5,
            tax_rate_value: 19,
          },
        ],
      };

      const result = createSupplierPOSchema.safeParse(validPO);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un BC sans lignes', () => {
      const invalidPO = {
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        items: [],
      };

      const result = createSupplierPOSchema.safeParse(invalidPO);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('au moins une ligne');
      }
    });

    it('devrait rejeter une quantité négative', () => {
      const invalidPO = {
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          {
            description: 'Produit test',
            quantity_ordered: -5,
            unit_price_ht: 100,
            tax_rate_value: 19,
          },
        ],
      };

      const result = createSupplierPOSchema.safeParse(invalidPO);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('supérieure');
      }
    });

    it('devrait rejeter un prix unitaire négatif', () => {
      const invalidPO = {
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          {
            description: 'Produit test',
            quantity_ordered: 10,
            unit_price_ht: -100,
            tax_rate_value: 19,
          },
        ],
      };

      const result = createSupplierPOSchema.safeParse(invalidPO);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('supérieur à 0');
      }
    });

    it('devrait rejeter un taux de TVA > 100%', () => {
      const invalidPO = {
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          {
            description: 'Produit test',
            quantity_ordered: 10,
            unit_price_ht: 100,
            tax_rate_value: 150,
          },
        ],
      };

      const result = createSupplierPOSchema.safeParse(invalidPO);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100%');
      }
    });
  });

  describe('createPurchaseInvoiceSchema', () => {
    it('devrait valider une facture valide', () => {
      const validInvoice = {
        invoice_number_supplier: 'FACT-2024-001',
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_date: '2024-01-15',
        subtotal_ht: 1000.5,
        tax_amount: 190.095,
        timbre_fiscal: 1.0,
      };

      const result = createPurchaseInvoiceSchema.safeParse(validInvoice);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter une facture sans numéro', () => {
      const invalidInvoice = {
        invoice_number_supplier: '',
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_date: '2024-01-15',
        subtotal_ht: 1000,
        tax_amount: 190,
      };

      const result = createPurchaseInvoiceSchema.safeParse(invalidInvoice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('obligatoire');
      }
    });

    it('devrait rejeter une date invalide', () => {
      const invalidInvoice = {
        invoice_number_supplier: 'FACT-001',
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_date: '15/01/2024', // Format invalide
        subtotal_ht: 1000,
        tax_amount: 190,
      };

      const result = createPurchaseInvoiceSchema.safeParse(invalidInvoice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Date invalide');
      }
    });

    it('devrait rejeter un montant négatif', () => {
      const invalidInvoice = {
        invoice_number_supplier: 'FACT-001',
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_date: '2024-01-15',
        subtotal_ht: -1000,
        tax_amount: 190,
      };

      const result = createPurchaseInvoiceSchema.safeParse(invalidInvoice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ne peut pas être négatif');
      }
    });

    it('devrait rejeter une date d\'échéance antérieure à la date de facture', () => {
      const invalidInvoice = {
        invoice_number_supplier: 'FACT-001',
        supplier_id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_date: '2024-01-15',
        due_date: '2024-01-10', // Avant la date de facture
        subtotal_ht: 1000,
        tax_amount: 190,
      };

      const result = createPurchaseInvoiceSchema.safeParse(invalidInvoice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('postérieure ou égale');
      }
    });
  });

  describe('createGoodsReceiptSchema', () => {
    it('devrait valider un BR valide', () => {
      const validGR = {
        receipt_date: '2024-01-15',
        items: [
          {
            supplier_po_item_id: '123e4567-e89b-12d3-a456-426614174000',
            quantity_received: 10.5,
          },
        ],
      };

      const result = createGoodsReceiptSchema.safeParse(validGR);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un BR sans lignes', () => {
      const invalidGR = {
        receipt_date: '2024-01-15',
        items: [],
      };

      const result = createGoodsReceiptSchema.safeParse(invalidGR);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('au moins une ligne');
      }
    });

    it('devrait rejeter une quantité négative', () => {
      const invalidGR = {
        receipt_date: '2024-01-15',
        items: [
          {
            supplier_po_item_id: '123e4567-e89b-12d3-a456-426614174000',
            quantity_received: -5,
          },
        ],
      };

      const result = createGoodsReceiptSchema.safeParse(invalidGR);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive');
      }
    });
  });

  describe('disputeInvoiceSchema', () => {
    it('devrait valider un litige valide', () => {
      const validDispute = {
        dispute_reason: 'Montant incorrect sur la facture, écart de 100 TND',
      };

      const result = disputeInvoiceSchema.safeParse(validDispute);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un motif vide', () => {
      const invalidDispute = {
        dispute_reason: '',
      };

      const result = disputeInvoiceSchema.safeParse(invalidDispute);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('obligatoire');
      }
    });

    it('devrait rejeter un motif trop long', () => {
      const invalidDispute = {
        dispute_reason: 'A'.repeat(501),
      };

      const result = disputeInvoiceSchema.safeParse(invalidDispute);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500 caractères');
      }
    });

    it('devrait accepter un motif de longueur valide', () => {
      const validDispute = {
        dispute_reason: 'Motif de litige valide avec suffisamment de détails',
      };

      const result = disputeInvoiceSchema.safeParse(validDispute);
      expect(result.success).toBe(true);
    });
  });
});