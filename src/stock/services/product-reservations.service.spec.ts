import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductReservationsService } from './product-reservations.service';
import { Product } from '../entities/product.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProductReservationsService', () => {
  let service: ProductReservationsService;
  let productRepo: Repository<Product>;

  const mockProductRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductReservationsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<ProductReservationsService>(ProductReservationsService);
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReservation', () => {
    it('should create a reservation', async () => {
      const dto = {
        product_id: 'product-123',
        quantity: 10,
        supplier_id: 'supplier-123',
      };

      const mockProduct = {
        id: 'product-123',
        business_id: 'business-123',
        name: 'Test Product',
        sku: 'SKU-001',
        reserved_quantity: 0,
        quantity: 100,
        min_quantity: 10,
        unit: 'pcs',
        cost: 50,
        price: 100,
        is_active: true,
        default_supplier_id: 'supplier-456',
        default_supplier: { name: 'Default Supplier' },
      };

      const updatedProduct = {
        ...mockProduct,
        reserved_quantity: 10,
        reserved_supplier_id: 'supplier-123',
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(updatedProduct);
      mockProductRepository.query.mockResolvedValue([{ name: 'Reserved Supplier' }]);

      const result = await service.createReservation('business-123', dto);

      expect(productRepo.save).toHaveBeenCalled();
      expect(result.reserved_quantity).toBe(10);
      expect(result.reserved_supplier_id).toBe('supplier-123');
    });

    it('should throw NotFoundException if product not found', async () => {
      const dto = {
        product_id: 'non-existent',
        quantity: 10,
      };

      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.createReservation('business-123', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('clearReservation', () => {
    it('should clear a reservation', async () => {
      const mockProduct = {
        id: 'product-123',
        business_id: 'business-123',
        reserved_quantity: 10,
        reserved_supplier_id: 'supplier-123',
      };

      const clearedProduct = {
        ...mockProduct,
        reserved_quantity: 0,
        reserved_supplier_id: null,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(clearedProduct);

      await service.clearReservation('business-123', 'product-123');

      expect(productRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reserved_quantity: 0,
          reserved_supplier_id: null,
        }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.clearReservation('business-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateReservation', () => {
    it('should update reservation quantity', async () => {
      const mockProduct = {
        id: 'product-123',
        business_id: 'business-123',
        name: 'Test Product',
        sku: 'SKU-001',
        reserved_quantity: 10,
        quantity: 100,
        min_quantity: 10,
        unit: 'pcs',
        cost: 50,
        price: 100,
        is_active: true,
        default_supplier_id: 'supplier-456',
        default_supplier: { name: 'Default Supplier' },
      };

      const updatedProduct = {
        ...mockProduct,
        reserved_quantity: 20,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(updatedProduct);

      const result = await service.updateReservation('business-123', 'product-123', 20);

      expect(productRepo.save).toHaveBeenCalled();
      expect(result.reserved_quantity).toBe(20);
    });

    it('should throw BadRequestException if quantity is negative', async () => {
      const mockProduct = {
        id: 'product-123',
        business_id: 'business-123',
        is_active: true,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      await expect(
        service.updateReservation('business-123', 'product-123', -5),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReservations', () => {
    it('should return all reservations', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          name: 'Product 1',
          sku: 'SKU-001',
          reserved_quantity: 10,
          quantity: 100,
          min_quantity: 10,
          unit: 'pcs',
          cost: 50,
          price: 100,
          default_supplier_id: 'supplier-1',
          reserved_supplier_id: 'supplier-2',
          default_supplier: { name: 'Default Supplier' },
        },
      ];

      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockProducts),
      };

      mockProductRepository.createQueryBuilder.mockReturnValue(qb);
      mockProductRepository.query.mockResolvedValue([{ name: 'Reserved Supplier' }]);

      const result = await service.getReservations('business-123');

      expect(result).toHaveLength(1);
      expect(result[0].reserved_quantity).toBe(10);
    });
  });
});
