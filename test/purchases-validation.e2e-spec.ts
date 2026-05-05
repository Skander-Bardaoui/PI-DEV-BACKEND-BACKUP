import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ZodValidationPipe } from 'nestjs-zod';

describe('Purchases Validation (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let businessId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Configure validation pipes (same as main.ts)
    app.useGlobalPipes(
      new ZodValidationPipe(),
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    // TODO: Authenticate and get token
    // authToken = await authenticate();
    // businessId = await getBusinessId();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /businesses/:businessId/suppliers', () => {
    it('devrait créer un fournisseur valide', () => {
      const validSupplier = {
        name: 'Fournisseur Test E2E',
        email: 'test-e2e@example.com',
        phone: '+216 71 000 000',
        payment_terms: 30,
        category: 'Alimentaire',
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/suppliers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validSupplier)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(validSupplier.name);
          expect(res.body.email).toBe(validSupplier.email);
        });
    });

    it('devrait rejeter un nom trop court', () => {
      const invalidSupplier = {
        name: 'A',
        email: 'test@example.com',
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/suppliers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSupplier)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details).toBeDefined();
          expect(res.body.details.some((d: any) => 
            d.field === 'name' && d.message.includes('au moins 2 caractères')
          )).toBe(true);
        });
    });

    it('devrait rejeter un email invalide', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        email: 'invalid-email',
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/suppliers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSupplier)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'email' && d.message.includes('email invalide')
          )).toBe(true);
        });
    });

    it('devrait rejeter un délai de paiement négatif', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        payment_terms: -10,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/suppliers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSupplier)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'payment_terms' && d.message.includes('ne peut pas être négatif')
          )).toBe(true);
        });
    });

    it('devrait rejeter un délai de paiement > 365 jours', () => {
      const invalidSupplier = {
        name: 'Fournisseur Test',
        payment_terms: 400,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/suppliers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSupplier)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'payment_terms' && d.message.includes('365 jours')
          )).toBe(true);
        });
    });
  });

  describe('POST /businesses/:businessId/supplier-pos', () => {
    let supplierId: string;

    beforeAll(async () => {
      // TODO: Create a test supplier
      // supplierId = await createTestSupplier();
    });

    it('devrait créer un BC valide', () => {
      const validPO = {
        supplier_id: supplierId,
        expected_delivery: '2024-12-31',
        notes: 'BC de test E2E',
        items: [
          {
            description: 'Produit test E2E',
            quantity_ordered: 10,
            unit_price_ht: 100.5,
            tax_rate_value: 19,
          },
        ],
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/supplier-pos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPO)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.supplier_id).toBe(supplierId);
          expect(res.body.items).toHaveLength(1);
        });
    });

    it('devrait rejeter un BC sans lignes', () => {
      const invalidPO = {
        supplier_id: supplierId,
        items: [],
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/supplier-pos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPO)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'items' && d.message.includes('au moins une ligne')
          )).toBe(true);
        });
    });

    it('devrait rejeter une quantité négative', () => {
      const invalidPO = {
        supplier_id: supplierId,
        items: [
          {
            description: 'Produit test',
            quantity_ordered: -5,
            unit_price_ht: 100,
            tax_rate_value: 19,
          },
        ],
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/supplier-pos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPO)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field.includes('quantity_ordered') && d.message.includes('supérieure à 0')
          )).toBe(true);
        });
    });

    it('devrait rejeter un prix unitaire négatif', () => {
      const invalidPO = {
        supplier_id: supplierId,
        items: [
          {
            description: 'Produit test',
            quantity_ordered: 10,
            unit_price_ht: -100,
            tax_rate_value: 19,
          },
        ],
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/supplier-pos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPO)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field.includes('unit_price_ht') && d.message.includes('ne peut pas être négatif')
          )).toBe(true);
        });
    });

    it('devrait rejeter plus de 100 lignes', () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        description: `Produit ${i + 1}`,
        quantity_ordered: 1,
        unit_price_ht: 10,
        tax_rate_value: 19,
      }));

      const invalidPO = {
        supplier_id: supplierId,
        items,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/supplier-pos`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPO)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'items' && d.message.includes('100 lignes')
          )).toBe(true);
        });
    });
  });

  describe('POST /businesses/:businessId/purchase-invoices', () => {
    let supplierId: string;

    beforeAll(async () => {
      // TODO: Create a test supplier
      // supplierId = await createTestSupplier();
    });

    it('devrait créer une facture valide', () => {
      const validInvoice = {
        invoice_number_supplier: 'FACT-E2E-001',
        supplier_id: supplierId,
        invoice_date: '2024-01-15',
        subtotal_ht: 1000.5,
        tax_amount: 190.095,
        timbre_fiscal: 1.0,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validInvoice)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.invoice_number_supplier).toBe(validInvoice.invoice_number_supplier);
        });
    });

    it('devrait rejeter une facture sans numéro', () => {
      const invalidInvoice = {
        invoice_number_supplier: '',
        supplier_id: supplierId,
        invoice_date: '2024-01-15',
        subtotal_ht: 1000,
        tax_amount: 190,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidInvoice)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'invoice_number_supplier' && d.message.includes('obligatoire')
          )).toBe(true);
        });
    });

    it('devrait rejeter une date invalide', () => {
      const invalidInvoice = {
        invoice_number_supplier: 'FACT-001',
        supplier_id: supplierId,
        invoice_date: '15/01/2024', // Format invalide
        subtotal_ht: 1000,
        tax_amount: 190,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidInvoice)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'invoice_date' && d.message.includes('Date invalide')
          )).toBe(true);
        });
    });

    it('devrait rejeter un montant négatif', () => {
      const invalidInvoice = {
        invoice_number_supplier: 'FACT-001',
        supplier_id: supplierId,
        invoice_date: '2024-01-15',
        subtotal_ht: -1000,
        tax_amount: 190,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidInvoice)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'subtotal_ht' && d.message.includes('ne peut pas être négatif')
          )).toBe(true);
        });
    });

    it('devrait rejeter un montant trop élevé', () => {
      const invalidInvoice = {
        invoice_number_supplier: 'FACT-001',
        supplier_id: supplierId,
        invoice_date: '2024-01-15',
        subtotal_ht: 100000000, // > 99999999.999
        tax_amount: 190,
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidInvoice)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'subtotal_ht' && d.message.includes('99999999.999')
          )).toBe(true);
        });
    });
  });

  describe('POST /businesses/:businessId/purchase-invoices/:id/dispute', () => {
    let invoiceId: string;

    beforeAll(async () => {
      // TODO: Create a test invoice
      // invoiceId = await createTestInvoice();
    });

    it('devrait créer un litige valide', () => {
      const validDispute = {
        dispute_reason: 'Montant incorrect sur la facture, écart de 100 TND constaté',
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices/${invoiceId}/dispute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validDispute)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('disputed');
        });
    });

    it('devrait rejeter un motif trop court', () => {
      const invalidDispute = {
        dispute_reason: 'Court',
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices/${invoiceId}/dispute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDispute)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'dispute_reason' && d.message.includes('au moins 10 caractères')
          )).toBe(true);
        });
    });

    it('devrait rejeter un motif trop long', () => {
      const invalidDispute = {
        dispute_reason: 'A'.repeat(501),
      };

      return request(app.getHttpServer())
        .post(`/businesses/${businessId}/purchase-invoices/${invoiceId}/dispute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDispute)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Erreur de validation');
          expect(res.body.details.some((d: any) => 
            d.field === 'dispute_reason' && d.message.includes('500 caractères')
          )).toBe(true);
        });
    });
  });
});