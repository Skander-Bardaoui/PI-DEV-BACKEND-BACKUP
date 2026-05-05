import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThreeWayMatchingService, MatchStatus } from './three-way-matching.service';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { SupplierPO } from '../entities/supplier-po.entity';
import { GoodsReceipt } from '../entities/goods-receipt.entity';
import { ThreeWayMatchingAIService } from './three-way-matching-ai.service';
import { InvoiceStatus } from '../enum/invoice-status.enum';
import { NotFoundException } from '@nestjs/common';

describe('ThreeWayMatchingService', () => {
  let service: ThreeWayMatchingService;
  let invoiceRepo: Repository<PurchaseInvoice>;
  let poRepo: Repository<SupplierPO>;
  let grRepo: Repository<GoodsReceipt>;
  let aiService: ThreeWayMatchingAIService;

  const mockBusinessId = 'business-123';
  const mockInvoiceId = 'invoice-456';
  const mockPOId = 'po-789';

  const mockInvoice = {
    id: mockInvoiceId,
    business_id: mockBusinessId,
    invoice_number_supplier: 'INV-001',
    supplier_id: 'supplier-123',
    supplier_po_id: mockPOId,
    net_amount: 1191,
    supplier: {
      id: 'supplier-123',
      name: 'Test Supplier',
      email: 'supplier@test.com',
    },
  };

  const mockPO = {
    id: mockPOId,
    po_number: 'ACH-2024-0001',
    business_id: mockBusinessId,
    supplier_id: 'supplier-123',
    net_amount: 1191,
    items: [
      {
        id: 'item-1',
        description: 'Product A',
        quantity_ordered: 10,
        quantity_received: 10,
        unit_price_ht: 100,
        tax_rate_value: 19,
      },
    ],
    supplier: {
      id: 'supplier-123',
      name: 'Test Supplier',
      email: 'supplier@test.com',
    },
  };

  const mockGR = {
    id: 'gr-1',
    gr_number: 'BR-2024-0001',
    supplier_po_id: mockPOId,
    business_id: mockBusinessId,
    items: [
      {
        supplier_po_item_id: 'item-1',
        quantity_received: 10,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreeWayMatchingService,
        {
          provide: getRepositoryToken(PurchaseInvoice),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SupplierPO),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GoodsReceipt),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: ThreeWayMatchingAIService,
          useValue: {
            analyzeMatching: jest.fn(),
            getFallbackAnalysis: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ThreeWayMatchingService>(ThreeWayMatchingService);
    invoiceRepo = module.get<Repository<PurchaseInvoice>>(
      getRepositoryToken(PurchaseInvoice),
    );
    poRepo = module.get<Repository<SupplierPO>>(getRepositoryToken(SupplierPO));
    grRepo = module.get<Repository<GoodsReceipt>>(getRepositoryToken(GoodsReceipt));
    aiService = module.get<ThreeWayMatchingAIService>(ThreeWayMatchingAIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('matchInvoice', () => {
    it('should return MISSING_PO status when no PO is associated', async () => {
      const invoiceWithoutPO = { ...mockInvoice, supplier_po_id: null };

      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(invoiceWithoutPO as any);

      const result = await service.matchInvoice(mockBusinessId, mockInvoiceId, false, false);

      expect(result.status).toBe(MatchStatus.MISSING_PO);
      expect(result.can_auto_approve).toBe(false);
    });

    it('should return MISSING_GR status when no goods receipts exist', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as any);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([]);

      const result = await service.matchInvoice(mockBusinessId, mockInvoiceId, false, false);

      expect(result.status).toBe(MatchStatus.MISSING_GR);
      expect(result.can_auto_approve).toBe(false);
    });

    it('should return MATCHED status when everything matches perfectly', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as any);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([mockGR] as any);

      const result = await service.matchInvoice(mockBusinessId, mockInvoiceId, false, false);

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.can_auto_approve).toBe(true);
    });

    it('should return OVER_INVOICED status when invoice amount exceeds received amount', async () => {
      const overInvoice = { ...mockInvoice, net_amount: 2000 };

      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(overInvoice as any);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([mockGR] as any);

      const result = await service.matchInvoice(mockBusinessId, mockInvoiceId, false, false);

      expect(result.status).toBe(MatchStatus.OVER_INVOICED);
      expect(result.should_auto_dispute).toBe(true);
    });

    it('should throw NotFoundException if invoice not found', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.matchInvoice(mockBusinessId, 'non-existent', false, false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should auto-approve when autoAction is true and can_auto_approve is true', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as any);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([mockGR] as any);
      jest.spyOn(invoiceRepo, 'update').mockResolvedValue({} as any);

      await service.matchInvoice(mockBusinessId, mockInvoiceId, true, false);

      expect(invoiceRepo.update).toHaveBeenCalledWith(
        { id: mockInvoiceId, business_id: mockBusinessId },
        { status: InvoiceStatus.APPROVED },
      );
    });

    it('should auto-dispute when autoAction is true and should_auto_dispute is true', async () => {
      const overInvoice = { ...mockInvoice, net_amount: 2000 };

      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(overInvoice as any);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([mockGR] as any);
      jest.spyOn(invoiceRepo, 'update').mockResolvedValue({} as any);

      await service.matchInvoice(mockBusinessId, mockInvoiceId, true, false);

      expect(invoiceRepo.update).toHaveBeenCalledWith(
        { id: mockInvoiceId, business_id: mockBusinessId },
        expect.objectContaining({ status: InvoiceStatus.DISPUTED }),
      );
    });
  });

  describe('matchAllPending', () => {
    it('should match all pending invoices', async () => {
      const pendingInvoices = [mockInvoice];

      jest.spyOn(invoiceRepo, 'find').mockResolvedValue(pendingInvoices as any);
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as any);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([mockGR] as any);

      const results = await service.matchAllPending(mockBusinessId, false, false);

      expect(results).toHaveLength(1);
      expect(results[0].invoice_id).toBe(mockInvoiceId);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const pendingInvoices = [mockInvoice, { ...mockInvoice, id: 'invoice-2' }];

      jest.spyOn(invoiceRepo, 'find').mockResolvedValue(pendingInvoices as any);
      jest
        .spyOn(invoiceRepo, 'findOne')
        .mockResolvedValueOnce(mockInvoice as any)
        .mockResolvedValueOnce(null);
      jest.spyOn(poRepo, 'findOne').mockResolvedValue(mockPO as any);
      jest.spyOn(grRepo, 'find').mockResolvedValue([mockGR] as any);

      const results = await service.matchAllPending(mockBusinessId, false, false);

      expect(results).toHaveLength(1);
    });
  });
});