import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuppliersService } from './suppliers.service';
import { Supplier } from '../entities/supplier.entity';
import { SupplierPO } from '../entities/supplier-po.entity';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { GoodsReceipt } from '../entities/goods-receipt.entity';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { POStatus } from '../enum/po-status.enum';
import { InvoiceStatus } from '../enum/invoice-status.enum';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let supplierRepo: Repository<Supplier>;
  let supplierPORepo: Repository<SupplierPO>;
  let invoiceRepo: Repository<PurchaseInvoice>;
  let goodsReceiptRepo: Repository<GoodsReceipt>;

  const mockBusinessId = 'business-123';
  const mockSupplierId = 'supplier-456';

  const mockSupplier: Partial<Supplier> = {
    id: mockSupplierId,
    business_id: mockBusinessId,
    name: 'Test Supplier',
    email: 'test@supplier.com',
    phone: '123456789',
    is_active: true,
    payment_terms: 30,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: getRepositoryToken(Supplier),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SupplierPO),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PurchaseInvoice),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GoodsReceipt),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    supplierRepo = module.get<Repository<Supplier>>(
      getRepositoryToken(Supplier),
    );
    supplierPORepo = module.get<Repository<SupplierPO>>(
      getRepositoryToken(SupplierPO),
    );
    invoiceRepo = module.get<Repository<PurchaseInvoice>>(
      getRepositoryToken(PurchaseInvoice),
    );
    goodsReceiptRepo = module.get<Repository<GoodsReceipt>>(
      getRepositoryToken(GoodsReceipt),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new supplier successfully', async () => {
      const createDto = {
        name: 'New Supplier',
        email: 'new@supplier.com',
        phone: '987654321',
        payment_terms: 30,
      };

      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(supplierRepo, 'create').mockReturnValue(mockSupplier as Supplier);
      jest.spyOn(supplierRepo, 'save').mockResolvedValue(mockSupplier as Supplier);

      const result = await service.create(mockBusinessId, createDto);

      expect(result).toEqual(mockSupplier);
      expect(supplierRepo.findOne).toHaveBeenCalledWith({
        where: { business_id: mockBusinessId, name: createDto.name, is_active: true },
      });
      expect(supplierRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if supplier already exists', async () => {
      const createDto = {
        name: 'Existing Supplier',
        email: 'existing@supplier.com',
        phone: '111111111',
      };

      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(mockSupplier as Supplier);

      await expect(service.create(mockBusinessId, createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(mockSupplier as Supplier);

      const result = await service.findOne(mockBusinessId, mockSupplierId);

      expect(result).toEqual(mockSupplier);
      expect(supplierRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockSupplierId, business_id: mockBusinessId },
      });
    });

    it('should throw NotFoundException if supplier not found', async () => {
      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.findOne(mockBusinessId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated suppliers', async () => {
      const mockSuppliers = [mockSupplier];
      jest.spyOn(supplierRepo, 'findAndCount').mockResolvedValue([mockSuppliers as Supplier[], 1]);

      const result = await service.findAll(mockBusinessId, { page: 1, limit: 20 });

      expect(result.data).toEqual(mockSuppliers);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
    });

    it('should filter suppliers by search term', async () => {
      const mockSuppliers = [mockSupplier];
      jest.spyOn(supplierRepo, 'findAndCount').mockResolvedValue([mockSuppliers as Supplier[], 1]);

      const result = await service.findAll(mockBusinessId, {
        search: 'Test',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockSuppliers);
      expect(supplierRepo.findAndCount).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a supplier successfully', async () => {
      const updateDto = { name: 'Updated Supplier' };
      const updatedSupplier = { ...mockSupplier, ...updateDto };

      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(mockSupplier as Supplier);
      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(supplierRepo, 'save').mockResolvedValue(updatedSupplier as Supplier);

      const result = await service.update(mockBusinessId, mockSupplierId, updateDto);

      expect(result.name).toBe('Updated Supplier');
      expect(supplierRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if new name already exists', async () => {
      const updateDto = { name: 'Duplicate Name' };
      const duplicateSupplier = { ...mockSupplier, id: 'different-id' };

      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(mockSupplier as Supplier);
      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(duplicateSupplier as Supplier);

      await expect(
        service.update(mockBusinessId, mockSupplierId, updateDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('archive', () => {
    it('should archive a supplier successfully when no blocking conditions', async () => {
      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(mockSupplier as Supplier);
      jest.spyOn(supplierPORepo, 'count').mockResolvedValue(0);
      jest.spyOn(invoiceRepo, 'count').mockResolvedValue(0);
      jest.spyOn(goodsReceiptRepo, 'createQueryBuilder').mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      } as any);
      jest.spyOn(supplierRepo, 'save').mockResolvedValue({
        ...mockSupplier,
        is_active: false,
      } as Supplier);

      const result = await service.archive(mockBusinessId, mockSupplierId);

      expect(result.message).toContain('archivé avec succès');
      expect(supplierRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if supplier already archived', async () => {
      const archivedSupplier = { ...mockSupplier, is_active: false };
      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(archivedSupplier as Supplier);

      await expect(
        service.archive(mockBusinessId, mockSupplierId),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if active POs exist', async () => {
      const activeSupplier = { ...mockSupplier, is_active: true };
      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(activeSupplier as Supplier);
      jest.spyOn(supplierPORepo, 'count').mockResolvedValue(2);

      await expect(
        service.archive(mockBusinessId, mockSupplierId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if unpaid invoices exist', async () => {
      const activeSupplier = { ...mockSupplier, is_active: true };
      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(activeSupplier as Supplier);
      jest.spyOn(supplierPORepo, 'count').mockResolvedValue(0);
      jest.spyOn(invoiceRepo, 'count').mockResolvedValue(3);

      await expect(
        service.archive(mockBusinessId, mockSupplierId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if incomplete receipts exist', async () => {
      const activeSupplier = { ...mockSupplier, is_active: true };
      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(activeSupplier as Supplier);
      jest.spyOn(supplierPORepo, 'count').mockResolvedValue(0);
      jest.spyOn(invoiceRepo, 'count').mockResolvedValue(0);
      jest.spyOn(goodsReceiptRepo, 'createQueryBuilder').mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      } as any);

      await expect(
        service.archive(mockBusinessId, mockSupplierId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('restore', () => {
    it('should restore an archived supplier', async () => {
      const archivedSupplier = { ...mockSupplier, is_active: false };
      const restoredSupplier = { ...mockSupplier, is_active: true };

      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(archivedSupplier as Supplier);
      jest.spyOn(supplierRepo, 'save').mockResolvedValue(restoredSupplier as Supplier);

      const result = await service.restore(mockBusinessId, mockSupplierId);

      expect(result.is_active).toBe(true);
      expect(supplierRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if supplier already active', async () => {
      const activeSupplier = { ...mockSupplier, is_active: true };
      jest.spyOn(service, 'findOneOrFail').mockResolvedValue(activeSupplier as Supplier);

      await expect(
        service.restore(mockBusinessId, mockSupplierId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOneOrFail', () => {
    it('should return supplier if found', async () => {
      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(mockSupplier as Supplier);

      const result = await service.findOneOrFail(mockBusinessId, mockSupplierId);

      expect(result).toEqual(mockSupplier);
    });

    it('should throw NotFoundException if supplier not found', async () => {
      jest.spyOn(supplierRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.findOneOrFail(mockBusinessId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});