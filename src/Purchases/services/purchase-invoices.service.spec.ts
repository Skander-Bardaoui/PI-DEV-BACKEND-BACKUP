import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InvoiceStatus } from '../enum/invoice-status.enum';

describe('PurchaseInvoicesService', () => {
  let service: PurchaseInvoicesService;
  let invoiceRepo: Repository<PurchaseInvoice>;

  const mockBusinessId = 'business-123';
  const mockInvoiceId = 'invoice-456';

  const mockInvoice: Partial<PurchaseInvoice> = {
    id: mockInvoiceId,
    business_id: mockBusinessId,
    invoice_number_supplier: 'INV-001',
    supplier_id: 'supplier-123',
    invoice_date: new Date('2024-01-01'),
    due_date: new Date('2024-01-31'),
    subtotal_ht: 1000,
    tax_amount: 190,
    timbre_fiscal: 1,
    net_amount: 1191,
    paid_amount: 0,
    status: InvoiceStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseInvoicesService,
        {
          provide: getRepositoryToken(PurchaseInvoice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseInvoicesService>(PurchaseInvoicesService);
    invoiceRepo = module.get<Repository<PurchaseInvoice>>(
      getRepositoryToken(PurchaseInvoice),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new purchase invoice successfully', async () => {
      const createDto = {
        invoice_number_supplier: 'INV-002',
        supplier_id: 'supplier-123',
        invoice_date: new Date('2024-01-15'),
        subtotal_ht: 500,
        tax_amount: 95,
        timbre_fiscal: 1,
      };

      jest.spyOn(invoiceRepo, 'create').mockReturnValue(mockInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(mockInvoice as PurchaseInvoice);

      const result = await service.create(mockBusinessId, createDto as any);

      expect(result).toEqual(mockInvoice);
      expect(invoiceRepo.create).toHaveBeenCalled();
      expect(invoiceRepo.save).toHaveBeenCalled();
    });

    it('should calculate net_amount correctly', async () => {
      const createDto = {
        invoice_number_supplier: 'INV-003',
        supplier_id: 'supplier-123',
        invoice_date: new Date('2024-01-15'),
        subtotal_ht: 1000,
        tax_amount: 190,
        timbre_fiscal: 1,
      };

      const expectedNetAmount = 1191; // 1000 + 190 + 1

      jest.spyOn(invoiceRepo, 'create').mockImplementation((dto: any) => {
        expect(dto.net_amount).toBe(expectedNetAmount);
        return mockInvoice as PurchaseInvoice;
      });
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(mockInvoice as PurchaseInvoice);

      await service.create(mockBusinessId, createDto as any);

      expect(invoiceRepo.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an invoice by id', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);

      const result = await service.findOne(mockBusinessId, mockInvoiceId);

      expect(result).toEqual(mockInvoice);
      expect(invoiceRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockInvoiceId, business_id: mockBusinessId },
        relations: ['supplier', 'supplier_po'],
      });
    });

    it('should throw NotFoundException if invoice not found', async () => {
      jest.spyOn(invoiceRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.findOne(mockBusinessId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      const mockInvoices = [mockInvoice];
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockInvoices, 1]),
      };

      jest.spyOn(invoiceRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll(mockBusinessId, { page: 1, limit: 20 });

      expect(result.data).toEqual(mockInvoices);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
    });

    it('should filter invoices by status', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockInvoice], 1]),
      };

      jest.spyOn(invoiceRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await service.findAll(mockBusinessId, {
        status: InvoiceStatus.PENDING,
        page: 1,
        limit: 20,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should approve a pending invoice', async () => {
      const approvedInvoice = { ...mockInvoice, status: InvoiceStatus.APPROVED };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(approvedInvoice as PurchaseInvoice);

      const result = await service.approve(mockBusinessId, mockInvoiceId);

      expect(result.status).toBe(InvoiceStatus.APPROVED);
      expect(invoiceRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if invoice is not pending', async () => {
      const approvedInvoice = { ...mockInvoice, status: InvoiceStatus.APPROVED };

      jest.spyOn(service, 'findOne').mockResolvedValue(approvedInvoice as PurchaseInvoice);

      await expect(
        service.approve(mockBusinessId, mockInvoiceId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePayment', () => {
    it('should update payment amount and set status to PARTIALLY_PAID', async () => {
      const updateDto = { paid_amount: 500 };
      const updatedInvoice = {
        ...mockInvoice,
        paid_amount: 500,
        status: InvoiceStatus.PARTIALLY_PAID,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(updatedInvoice as PurchaseInvoice);

      const result = await service.updatePayment(mockBusinessId, mockInvoiceId, updateDto);

      expect(result.paid_amount).toBe(500);
      expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('should set status to PAID when fully paid', async () => {
      const updateDto = { paid_amount: 1191 };
      const paidInvoice = {
        ...mockInvoice,
        paid_amount: 1191,
        status: InvoiceStatus.PAID,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(paidInvoice as PurchaseInvoice);

      const result = await service.updatePayment(mockBusinessId, mockInvoiceId, updateDto);

      expect(result.status).toBe(InvoiceStatus.PAID);
    });

    it('should throw BadRequestException if paid amount is negative', async () => {
      const updateDto = { paid_amount: -100 };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);

      await expect(
        service.updatePayment(mockBusinessId, mockInvoiceId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if paid amount exceeds net amount', async () => {
      const updateDto = { paid_amount: 2000 };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);

      await expect(
        service.updatePayment(mockBusinessId, mockInvoiceId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('dispute', () => {
    it('should mark invoice as disputed', async () => {
      const pendingInvoice = { ...mockInvoice, status: InvoiceStatus.PENDING };
      const disputeDto = { dispute_reason: 'Incorrect amount' };
      const disputedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.DISPUTED,
        dispute_reason: 'Incorrect amount',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(pendingInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(disputedInvoice as PurchaseInvoice);

      const result = await service.dispute(mockBusinessId, mockInvoiceId, disputeDto);

      expect(result.status).toBe(InvoiceStatus.DISPUTED);
      expect(result.dispute_reason).toBe('Incorrect amount');
    });

    it('should throw BadRequestException if invoice is already paid', async () => {
      const paidInvoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      const disputeDto = { dispute_reason: 'Test' };

      jest.spyOn(service, 'findOne').mockResolvedValue(paidInvoice as PurchaseInvoice);

      await expect(
        service.dispute(mockBusinessId, mockInvoiceId, disputeDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveDispute', () => {
    it('should resolve a disputed invoice', async () => {
      const disputedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.DISPUTED,
        dispute_reason: 'Test reason',
      };
      const resolvedInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.APPROVED,
        dispute_reason: null,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(disputedInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(resolvedInvoice as PurchaseInvoice);

      const result = await service.resolveDispute(mockBusinessId, mockInvoiceId);

      expect(result.status).toBe(InvoiceStatus.APPROVED);
      expect(result.dispute_reason).toBeNull();
    });

    it('should throw BadRequestException if invoice is not disputed', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockInvoice as PurchaseInvoice);

      await expect(
        service.resolveDispute(mockBusinessId, mockInvoiceId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a pending invoice', async () => {
      const pendingInvoice = { ...mockInvoice, status: InvoiceStatus.PENDING };
      const updateDto = { subtotal_ht: 1200, tax_amount: 228 };
      const updatedInvoice = { ...mockInvoice, ...updateDto, net_amount: 1429 };

      jest.spyOn(service, 'findOne').mockResolvedValue(pendingInvoice as PurchaseInvoice);
      jest.spyOn(invoiceRepo, 'save').mockResolvedValue(updatedInvoice as PurchaseInvoice);

      const result = await service.update(mockBusinessId, mockInvoiceId, updateDto);

      expect(result.subtotal_ht).toBe(1200);
      expect(invoiceRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if invoice is not pending', async () => {
      const approvedInvoice = { ...mockInvoice, status: InvoiceStatus.APPROVED };
      const updateDto = { subtotal_ht: 1200 };

      jest.spyOn(service, 'findOne').mockResolvedValue(approvedInvoice as PurchaseInvoice);

      await expect(
        service.update(mockBusinessId, mockInvoiceId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});