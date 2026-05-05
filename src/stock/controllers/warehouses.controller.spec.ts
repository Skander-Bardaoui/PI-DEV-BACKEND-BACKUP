import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from '../services/warehouses.service';

describe('WarehousesController', () => {
  let controller: WarehousesController;
  let service: WarehousesService;

  const mockWarehousesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getWarehouseStock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarehousesController],
      providers: [
        {
          provide: WarehousesService,
          useValue: mockWarehousesService,
        },
      ],
    }).compile();

    controller = module.get<WarehousesController>(WarehousesController);
    service = module.get<WarehousesService>(WarehousesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all warehouses', async () => {
      const businessId = 'business-123';
      const mockWarehouses = [
        { id: 'warehouse-1', name: 'Warehouse 1' },
        { id: 'warehouse-2', name: 'Warehouse 2' },
      ];

      mockWarehousesService.findAll.mockResolvedValue(mockWarehouses);

      const result = await controller.findAll(businessId);

      expect(service.findAll).toHaveBeenCalledWith(businessId, undefined);
      expect(result).toEqual(mockWarehouses);
    });

    it('should filter by is_active', async () => {
      const businessId = 'business-123';
      const mockWarehouses = [
        { id: 'warehouse-1', name: 'Warehouse 1', is_active: true },
      ];

      mockWarehousesService.findAll.mockResolvedValue(mockWarehouses);

      const result = await controller.findAll(businessId, 'true');

      expect(service.findAll).toHaveBeenCalledWith(businessId, true);
      expect(result).toEqual(mockWarehouses);
    });
  });

  describe('findOne', () => {
    it('should return a warehouse by id', async () => {
      const businessId = 'business-123';
      const warehouseId = 'warehouse-123';
      const mockWarehouse = {
        id: warehouseId,
        name: 'Test Warehouse',
      };

      mockWarehousesService.findOne.mockResolvedValue(mockWarehouse);

      const result = await controller.findOne(businessId, warehouseId);

      expect(service.findOne).toHaveBeenCalledWith(businessId, warehouseId);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe('create', () => {
    it('should create a warehouse', async () => {
      const businessId = 'business-123';
      const dto = {
        name: 'New Warehouse',
        code: 'WH3',
      };

      const mockWarehouse = {
        id: 'warehouse-123',
        ...dto,
      };

      mockWarehousesService.create.mockResolvedValue(mockWarehouse);

      const result = await controller.create(businessId, dto);

      expect(service.create).toHaveBeenCalledWith(businessId, dto);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe('update', () => {
    it('should update a warehouse', async () => {
      const businessId = 'business-123';
      const warehouseId = 'warehouse-123';
      const dto = {
        name: 'Updated Warehouse',
      };

      const mockWarehouse = {
        id: warehouseId,
        ...dto,
      };

      mockWarehousesService.update.mockResolvedValue(mockWarehouse);

      const result = await controller.update(businessId, warehouseId, dto);

      expect(service.update).toHaveBeenCalledWith(businessId, warehouseId, dto);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe('remove', () => {
    it('should remove a warehouse', async () => {
      const businessId = 'business-123';
      const warehouseId = 'warehouse-123';

      mockWarehousesService.remove.mockResolvedValue(undefined);

      await controller.remove(businessId, warehouseId);

      expect(service.remove).toHaveBeenCalledWith(businessId, warehouseId);
    });
  });

  describe('getWarehouseStock', () => {
    it('should return warehouse stock with transformed format', async () => {
      const businessId = 'business-123';
      const warehouseId = 'warehouse-123';
      const mockProducts = [
        {
          id: 'product-1',
          sku: 'SKU-001',
          price: 100,
          cost: 80,
          quantity: 50,
          min_quantity: 10,
          track_inventory: true,
        },
      ];

      mockWarehousesService.getWarehouseStock.mockResolvedValue(mockProducts);

      const result = await controller.getWarehouseStock(businessId, warehouseId);

      expect(service.getWarehouseStock).toHaveBeenCalledWith(businessId, warehouseId);
      expect(result[0].reference).toBe('SKU-001');
      expect(result[0].sale_price_ht).toBe(100);
      expect(result[0].current_stock).toBe(50);
    });
  });
});
