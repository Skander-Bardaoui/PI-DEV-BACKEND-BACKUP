import { Test, TestingModule } from '@nestjs/testing';
import { StockDashboardController } from './stock-dashboard.controller';
import { StockDashboardService } from '../services/stock-dashboard.service';

describe('StockDashboardController', () => {
  let controller: StockDashboardController;
  let service: StockDashboardService;

  const mockDashboardService = {
    getDashboard: jest.fn(),
    getProductsDashboard: jest.fn(),
    getServicesDashboard: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockDashboardController],
      providers: [
        {
          provide: StockDashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<StockDashboardController>(StockDashboardController);
    service = module.get<StockDashboardService>(StockDashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return dashboard data', async () => {
      const businessId = 'business-123';
      const mockDashboard = {
        summary: {
          total_products: 100,
          total_services: 20,
          low_stock_count: 5,
          out_of_stock_count: 2,
          total_categories: 10,
          total_movements: 500,
          total_stock_value: 50000,
        },
        low_stock_products: [],
        recent_movements: [],
        movements_chart: [],
        stock_forecast: [],
      };

      mockDashboardService.getDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard(businessId);

      expect(service.getDashboard).toHaveBeenCalledWith(businessId);
      expect(result).toEqual(mockDashboard);
      expect(result.summary.total_products).toBe(100);
    });
  });

  describe('getProductsDashboard', () => {
    it('should return products dashboard data', async () => {
      const businessId = 'business-123';
      const mockDashboard = {
        summary: {
          total_products: 100,
          total_services: 0,
          low_stock_count: 5,
          out_of_stock_count: 2,
          total_categories: 8,
          total_movements: 400,
          total_stock_value: 45000,
        },
        low_stock_products: [
          {
            id: 'product-1',
            name: 'Product 1',
            sku: 'SKU-001',
            quantity: 5,
            min_quantity: 10,
            unit: 'pcs',
            category_name: 'Electronics',
            stock_percentage: 50,
          },
        ],
        recent_movements: [],
        movements_chart: [],
        stock_forecast: [],
      };

      mockDashboardService.getProductsDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getProductsDashboard(businessId);

      expect(service.getProductsDashboard).toHaveBeenCalledWith(businessId);
      expect(result.summary.total_products).toBe(100);
      expect(result.low_stock_products).toHaveLength(1);
    });
  });

  describe('getServicesDashboard', () => {
    it('should return services dashboard data', async () => {
      const businessId = 'business-123';
      const mockDashboard = {
        summary: {
          total_products: 0,
          total_services: 20,
          low_stock_count: 0,
          out_of_stock_count: 0,
          total_categories: 5,
          total_movements: 100,
          total_stock_value: 5000,
        },
        low_stock_products: [],
        recent_movements: [],
        movements_chart: [],
        stock_forecast: [],
      };

      mockDashboardService.getServicesDashboard.mockResolvedValue(mockDashboard);

      const result = await controller.getServicesDashboard(businessId);

      expect(service.getServicesDashboard).toHaveBeenCalledWith(businessId);
      expect(result.summary.total_services).toBe(20);
      expect(result.low_stock_products).toHaveLength(0);
    });
  });
});
