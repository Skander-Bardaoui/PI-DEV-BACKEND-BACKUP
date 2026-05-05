import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockDashboardService } from './stock-dashboard.service';
import { Product, ProductType } from '../entities/product.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { StockMovement } from '../entities/stock-movement.entity';

describe('StockDashboardService', () => {
  let service: StockDashboardService;
  let productRepository: Repository<Product>;
  let categoryRepository: Repository<ProductCategory>;
  let movementRepository: Repository<StockMovement>;

  const mockProductRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      getMany: jest.fn(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
    })),
  };

  const mockCategoryRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
    })),
  };

  const mockMovementRepository = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      getMany: jest.fn(),
      getRawMany: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockDashboardService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(ProductCategory),
          useValue: mockCategoryRepository,
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: mockMovementRepository,
        },
      ],
    }).compile();

    service = module.get<StockDashboardService>(StockDashboardService);
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
    categoryRepository = module.get<Repository<ProductCategory>>(
      getRepositoryToken(ProductCategory),
    );
    movementRepository = module.get<Repository<StockMovement>>(
      getRepositoryToken(StockMovement),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return complete dashboard data', async () => {
      const businessId = 'business-123';

      // Mock summary data
      mockProductRepository.count.mockResolvedValueOnce(50); // total_products
      mockProductRepository.count.mockResolvedValueOnce(10); // total_services
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValueOnce(5); // low_stock_count
      
      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValueOnce(2); // out_of_stock_count

      mockCategoryRepository.count.mockResolvedValue(8); // total_categories
      mockMovementRepository.count.mockResolvedValue(150); // total_movements

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '25000' }); // total_stock_value

      // Mock low stock products
      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Low Stock Product',
          sku: 'SKU-001',
          quantity: 5,
          min_quantity: 10,
          unit: 'pcs',
          category: { name: 'Electronics' },
        },
      ]);

      // Mock recent movements
      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([
        {
          id: 'movement-1',
          type: 'ENTREE_ACHAT',
          quantity: 20,
          created_at: new Date(),
          product: { name: 'Product A', sku: 'SKU-A' },
          reference: 'REF-001',
        },
      ]);

      // Mock movements chart
      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([
        {
          date: new Date('2024-01-01'),
          entrees: '100',
          sorties: '50',
          ajustements: '10',
        },
      ]);

      // Mock stock forecast
      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Product A',
          sku: 'SKU-A',
          unit: 'pcs',
          current_quantity: '100',
          avg_daily_consumption: '5',
        },
      ]);

      const result = await service.getDashboard(businessId);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('low_stock_products');
      expect(result).toHaveProperty('recent_movements');
      expect(result).toHaveProperty('movements_chart');
      expect(result).toHaveProperty('stock_forecast');
      expect(result.summary.total_products).toBe(50);
      expect(result.summary.total_services).toBe(10);
    });
  });

  describe('getProductsDashboard', () => {
    it('should return products-specific dashboard data', async () => {
      const businessId = 'business-123';

      // Mock products summary
      mockProductRepository.count.mockResolvedValue(50);
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(5);

      const qb2 = mockCategoryRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(8);

      const qb3 = mockMovementRepository.createQueryBuilder();
      qb3.getCount.mockResolvedValue(100);

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getRawOne.mockResolvedValue({ total_value: '20000' });

      // Mock low stock products
      const qb5 = mockProductRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      // Mock product movements
      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getMany.mockResolvedValue([]);

      // Mock product movements chart
      const qb7 = mockMovementRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([]);

      // Mock stock forecast
      const qb8 = mockProductRepository.createQueryBuilder();
      qb8.getRawMany.mockResolvedValue([]);

      const result = await service.getProductsDashboard(businessId);

      expect(result).toHaveProperty('summary');
      expect(result.summary.total_products).toBe(50);
      expect(result.summary.total_services).toBe(0);
      expect(result).toHaveProperty('low_stock_products');
      expect(result).toHaveProperty('recent_movements');
      expect(result).toHaveProperty('movements_chart');
      expect(result).toHaveProperty('stock_forecast');
    });
  });

  describe('getServicesDashboard', () => {
    it('should return services-specific dashboard data', async () => {
      const businessId = 'business-123';

      // Mock services summary
      mockProductRepository.count.mockResolvedValue(15);

      const qb1 = mockCategoryRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(3);

      const qb2 = mockMovementRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(50);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '5000' });

      // Mock service activities
      const qb4 = mockMovementRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([
        {
          id: 'movement-1',
          type: 'SORTIE_VENTE',
          quantity: -1,
          created_at: new Date(),
          product: { name: 'Service A', sku: 'SRV-A' },
          reference: 'REF-001',
        },
      ]);

      // Mock service activities chart
      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getRawMany.mockResolvedValue([
        {
          date: new Date('2024-01-01'),
          entrees: '10',
          sorties: '8',
          ajustements: '0',
        },
      ]);

      const result = await service.getServicesDashboard(businessId);

      expect(result).toHaveProperty('summary');
      expect(result.summary.total_services).toBe(15);
      expect(result.summary.total_products).toBe(0);
      expect(result.low_stock_products).toEqual([]);
      expect(result.stock_forecast).toEqual([]);
      expect(result).toHaveProperty('recent_movements');
      expect(result).toHaveProperty('movements_chart');
    });
  });

  describe('Summary calculations', () => {
    it('should calculate correct summary statistics', async () => {
      const businessId = 'business-123';

      mockProductRepository.count
        .mockResolvedValueOnce(100) // total_products
        .mockResolvedValueOnce(20); // total_services

      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValueOnce(10); // low_stock_count

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValueOnce(3); // out_of_stock_count

      mockCategoryRepository.count.mockResolvedValue(15);
      mockMovementRepository.count.mockResolvedValue(500);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '50000.50' });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([]);

      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([]);

      const result = await service.getDashboard(businessId);

      expect(result.summary.total_products).toBe(100);
      expect(result.summary.total_services).toBe(20);
      expect(result.summary.low_stock_count).toBe(10);
      expect(result.summary.out_of_stock_count).toBe(3);
      expect(result.summary.total_categories).toBe(15);
      expect(result.summary.total_movements).toBe(500);
      expect(result.summary.total_stock_value).toBe(50000.50);
    });

    it('should handle null stock value', async () => {
      const businessId = 'business-123';

      mockProductRepository.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10);

      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValueOnce(5);

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValueOnce(2);

      mockCategoryRepository.count.mockResolvedValue(8);
      mockMovementRepository.count.mockResolvedValue(150);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: null });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([]);

      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([]);

      const result = await service.getDashboard(businessId);

      expect(result.summary.total_stock_value).toBe(0);
    });
  });

  describe('Low stock products', () => {
    it('should return low stock products with correct percentage', async () => {
      const businessId = 'business-123';

      mockProductRepository.count.mockResolvedValue(0);
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(0);

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(0);

      mockCategoryRepository.count.mockResolvedValue(0);
      mockMovementRepository.count.mockResolvedValue(0);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '0' });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Low Stock Item',
          sku: 'SKU-001',
          quantity: 3,
          min_quantity: 10,
          unit: 'pcs',
          category: { name: 'Category A' },
        },
        {
          id: 'product-2',
          name: 'Critical Stock Item',
          sku: 'SKU-002',
          quantity: 1,
          min_quantity: 20,
          unit: 'pcs',
          category: { name: 'Category B' },
        },
      ]);

      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([]);

      const result = await service.getDashboard(businessId);

      expect(result.low_stock_products).toHaveLength(2);
      expect(result.low_stock_products[0].stock_percentage).toBe(30); // 3/10 * 100
      expect(result.low_stock_products[1].stock_percentage).toBe(5); // 1/20 * 100
    });
  });

  describe('Recent movements', () => {
    it('should return recent movements with product details', async () => {
      const businessId = 'business-123';

      mockProductRepository.count.mockResolvedValue(0);
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(0);

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(0);

      mockCategoryRepository.count.mockResolvedValue(0);
      mockMovementRepository.count.mockResolvedValue(0);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '0' });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([]);

      const mockDate = new Date('2024-01-15T10:00:00Z');
      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([
        {
          id: 'movement-1',
          type: 'ENTREE_ACHAT',
          quantity: 50,
          created_at: mockDate,
          product: { name: 'Product A', sku: 'SKU-A' },
          reference: 'PO-001',
        },
        {
          id: 'movement-2',
          type: 'SORTIE_VENTE',
          quantity: -10,
          created_at: mockDate,
          product: { name: 'Product B', sku: 'SKU-B' },
          reference: 'SO-001',
        },
      ]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([]);

      const result = await service.getDashboard(businessId);

      expect(result.recent_movements).toHaveLength(2);
      expect(result.recent_movements[0].type).toBe('ENTREE_ACHAT');
      expect(result.recent_movements[0].quantity).toBe(50);
      expect(result.recent_movements[0].product_name).toBe('Product A');
      expect(result.recent_movements[1].type).toBe('SORTIE_VENTE');
      expect(result.recent_movements[1].quantity).toBe(-10);
    });
  });

  describe('Movements chart', () => {
    it('should return movements chart data for last 30 days', async () => {
      const businessId = 'business-123';

      mockProductRepository.count.mockResolvedValue(0);
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(0);

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(0);

      mockCategoryRepository.count.mockResolvedValue(0);
      mockMovementRepository.count.mockResolvedValue(0);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '0' });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([]);

      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([
        {
          date: new Date('2024-01-01'),
          entrees: '100',
          sorties: '50',
          ajustements: '5',
        },
        {
          date: new Date('2024-01-02'),
          entrees: '80',
          sorties: '60',
          ajustements: '10',
        },
      ]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([]);

      const result = await service.getDashboard(businessId);

      expect(result.movements_chart).toHaveLength(2);
      expect(result.movements_chart[0].date).toBe('2024-01-01');
      expect(result.movements_chart[0].entrees).toBe(100);
      expect(result.movements_chart[0].sorties).toBe(50);
      expect(result.movements_chart[0].ajustements).toBe(5);
    });
  });

  describe('Stock forecast', () => {
    it('should calculate stock forecast with risk levels', async () => {
      const businessId = 'business-123';

      mockProductRepository.count.mockResolvedValue(0);
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(0);

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(0);

      mockCategoryRepository.count.mockResolvedValue(0);
      mockMovementRepository.count.mockResolvedValue(0);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '0' });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([]);

      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Critical Product',
          sku: 'SKU-001',
          unit: 'pcs',
          current_quantity: '30',
          avg_daily_consumption: '5',
        },
        {
          id: 'product-2',
          name: 'Warning Product',
          sku: 'SKU-002',
          unit: 'pcs',
          current_quantity: '100',
          avg_daily_consumption: '4',
        },
        {
          id: 'product-3',
          name: 'OK Product',
          sku: 'SKU-003',
          unit: 'pcs',
          current_quantity: '500',
          avg_daily_consumption: '10',
        },
      ]);

      const result = await service.getDashboard(businessId);

      expect(result.stock_forecast).toHaveLength(3);
      
      // Critical: 30/5 = 6 days
      expect(result.stock_forecast[0].days_remaining).toBe(6);
      expect(result.stock_forecast[0].risk_level).toBe('CRITICAL');
      
      // Warning: 100/4 = 25 days
      expect(result.stock_forecast[1].days_remaining).toBe(25);
      expect(result.stock_forecast[1].risk_level).toBe('WARNING');
      
      // OK: 500/10 = 50 days
      expect(result.stock_forecast[2].days_remaining).toBe(50);
      expect(result.stock_forecast[2].risk_level).toBe('OK');
    });

    it('should handle zero quantity products', async () => {
      const businessId = 'business-123';

      mockProductRepository.count.mockResolvedValue(0);
      
      const qb1 = mockProductRepository.createQueryBuilder();
      qb1.getCount.mockResolvedValue(0);

      const qb2 = mockProductRepository.createQueryBuilder();
      qb2.getCount.mockResolvedValue(0);

      mockCategoryRepository.count.mockResolvedValue(0);
      mockMovementRepository.count.mockResolvedValue(0);

      const qb3 = mockProductRepository.createQueryBuilder();
      qb3.getRawOne.mockResolvedValue({ total_value: '0' });

      const qb4 = mockProductRepository.createQueryBuilder();
      qb4.getMany.mockResolvedValue([]);

      const qb5 = mockMovementRepository.createQueryBuilder();
      qb5.getMany.mockResolvedValue([]);

      const qb6 = mockMovementRepository.createQueryBuilder();
      qb6.getRawMany.mockResolvedValue([]);

      const qb7 = mockProductRepository.createQueryBuilder();
      qb7.getRawMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Out of Stock',
          sku: 'SKU-001',
          unit: 'pcs',
          current_quantity: '0',
          avg_daily_consumption: '5',
        },
      ]);

      const result = await service.getDashboard(businessId);

      expect(result.stock_forecast).toHaveLength(1);
      expect(result.stock_forecast[0].days_remaining).toBeNull();
      expect(result.stock_forecast[0].risk_level).toBe('CRITICAL');
    });
  });
});
