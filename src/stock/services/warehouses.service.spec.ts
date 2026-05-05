import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehousesService } from './warehouses.service';
import { Warehouse } from '../entities/warehouse.entity';
import { Product } from '../entities/product.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let warehouseRepo: Repository<Warehouse>;
  let productRepo: Repository<Product>;

  const mockWarehouseRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockProductRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: getRepositoryToken(Warehouse),
          useValue: mockWarehouseRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
    warehouseRepo = module.get<Repository<Warehouse>>(getRepositoryToken(Warehouse));
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all warehouses for a business', async () => {
      const businessId = 'business-123';
      const mockWarehouses = [
        { id: 'warehouse-1', name: 'Warehouse 1', code: 'WH1' },
        { id: 'warehouse-2', name: 'Warehouse 2', code: 'WH2' },
      ];

      mockWarehouseRepository.find.mockResolvedValue(mockWarehouses);

      const result = await service.findAll(businessId);

      expect(warehouseRepo.find).toHaveBeenCalledWith({
        where: { business_id: businessId },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(mockWarehouses);
    });

    it('should filter by is_active', async () => {
      const businessId = 'business-123';
      const mockWarehouses = [
        { id: 'warehouse-1', name: 'Warehouse 1', is_active: true },
      ];

      mockWarehouseRepository.find.mockResolvedValue(mockWarehouses);

      const result = await service.findAll(businessId, true);

      expect(warehouseRepo.find).toHaveBeenCalledWith({
        where: { business_id: businessId, is_active: true },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(mockWarehouses);
    });
  });

  describe('findOne', () => {
    it('should return a warehouse by id', async () => {
      const mockWarehouse = {
        id: 'warehouse-123',
        business_id: 'business-123',
        name: 'Test Warehouse',
      };

      mockWarehouseRepository.findOne.mockResolvedValue(mockWarehouse);

      const result = await service.findOne('business-123', 'warehouse-123');

      expect(warehouseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'warehouse-123', business_id: 'business-123' },
      });
      expect(result).toEqual(mockWarehouse);
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      mockWarehouseRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('business-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a warehouse', async () => {
      const dto = {
        name: 'New Warehouse',
        code: 'WH3',
        address: '123 Main St',
      };

      const mockWarehouse = {
        id: 'warehouse-123',
        business_id: 'business-123',
        ...dto,
      };

      mockWarehouseRepository.findOne.mockResolvedValue(null);
      mockWarehouseRepository.create.mockReturnValue(mockWarehouse);
      mockWarehouseRepository.save.mockResolvedValue(mockWarehouse);

      const result = await service.create('business-123', dto);

      expect(warehouseRepo.create).toHaveBeenCalled();
      expect(warehouseRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockWarehouse);
    });

    it('should throw BadRequestException if code already exists', async () => {
      const dto = {
        name: 'New Warehouse',
        code: 'WH1',
      };

      mockWarehouseRepository.findOne.mockResolvedValue({
        id: 'existing-warehouse',
        code: 'WH1',
      });

      await expect(service.create('business-123', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a warehouse', async () => {
      const dto = {
        name: 'Updated Warehouse',
      };

      const existingWarehouse = {
        id: 'warehouse-123',
        business_id: 'business-123',
        name: 'Old Warehouse',
        code: 'WH1',
      };

      const updatedWarehouse = {
        ...existingWarehouse,
        ...dto,
      };

      mockWarehouseRepository.findOne.mockResolvedValue(existingWarehouse);
      mockWarehouseRepository.save.mockResolvedValue(updatedWarehouse);

      const result = await service.update('business-123', 'warehouse-123', dto);

      expect(warehouseRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Warehouse');
    });
  });

  describe('remove', () => {
    it('should remove a warehouse', async () => {
      const mockWarehouse = {
        id: 'warehouse-123',
        business_id: 'business-123',
      };

      mockWarehouseRepository.findOne.mockResolvedValue(mockWarehouse);
      mockWarehouseRepository.remove.mockResolvedValue(mockWarehouse);

      await service.remove('business-123', 'warehouse-123');

      expect(warehouseRepo.remove).toHaveBeenCalledWith(mockWarehouse);
    });
  });

  describe('getWarehouseStock', () => {
    it('should return products in a warehouse', async () => {
      const businessId = 'business-123';
      const warehouseId = 'warehouse-123';

      const mockWarehouse = {
        id: warehouseId,
        business_id: businessId,
      };

      const mockProducts = [
        { id: 'product-1', name: 'Product 1', warehouse_id: warehouseId },
        { id: 'product-2', name: 'Product 2', warehouse_id: warehouseId },
      ];

      mockWarehouseRepository.findOne.mockResolvedValue(mockWarehouse);
      mockProductRepository.find.mockResolvedValue(mockProducts);

      const result = await service.getWarehouseStock(businessId, warehouseId);

      expect(productRepo.find).toHaveBeenCalledWith({
        where: {
          business_id: businessId,
          warehouse_id: warehouseId,
        },
        relations: ['category'],
        order: { name: 'ASC' },
      });
      expect(result).toEqual(mockProducts);
    });
  });
});
