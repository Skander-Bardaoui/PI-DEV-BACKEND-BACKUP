import { Test, TestingModule } from '@nestjs/testing';
import { ProductReservationsController } from './product-reservations.controller';
import { ProductReservationsService } from '../services/product-reservations.service';
import {
  CreateReservationDto,
  ReservationResponseDto,
} from '../dto/product-reservation.dto';

describe('ProductReservationsController', () => {
  let controller: ProductReservationsController;
  let service: ProductReservationsService;

  const mockReservationsService = {
    createReservation: jest.fn(),
    getReservations: jest.fn(),
    clearReservation: jest.fn(),
    updateReservation: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      business_id: 'business-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductReservationsController],
      providers: [
        {
          provide: ProductReservationsService,
          useValue: mockReservationsService,
        },
      ],
    }).compile();

    controller = module.get<ProductReservationsController>(
      ProductReservationsController,
    );
    service = module.get<ProductReservationsService>(
      ProductReservationsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReservation', () => {
    it('should create a product reservation', async () => {
      const dto: CreateReservationDto = {
        product_id: 'product-123',
        quantity: 10,
        supplier_id: 'supplier-123',
      };

      const mockResponse: ReservationResponseDto = {
        id: 'product-123',
        name: 'Test Product',
        sku: 'SKU-123',
        reserved_quantity: 10,
        current_quantity: 50,
        min_quantity: 5,
        unit: 'pcs',
        cost: 100,
        price: 150,
        default_supplier_id: 'supplier-123',
        supplier_name: 'Test Supplier',
        reserved_supplier_id: 'supplier-123',
        reserved_supplier_name: 'Test Supplier',
      };

      mockReservationsService.createReservation.mockResolvedValue(mockResponse);

      const result = await controller.createReservation(mockRequest, dto);

      expect(service.createReservation).toHaveBeenCalledWith('business-123', dto);
      expect(result).toEqual(mockResponse);
    });

    it('should create reservation with product and supplier details', async () => {
      const dto: CreateReservationDto = {
        product_id: 'product-456',
        quantity: 25,
        supplier_id: 'supplier-456',
      };

      const mockResponse: ReservationResponseDto = {
        id: 'product-456',
        name: 'Another Product',
        sku: 'SKU-456',
        reserved_quantity: 25,
        current_quantity: 100,
        min_quantity: 10,
        unit: 'pcs',
        cost: 200,
        price: 300,
        default_supplier_id: 'supplier-456',
        supplier_name: 'Another Supplier',
        reserved_supplier_id: 'supplier-456',
        reserved_supplier_name: 'Another Supplier',
      };

      mockReservationsService.createReservation.mockResolvedValue(mockResponse);

      const result = await controller.createReservation(mockRequest, dto);

      expect(result.reserved_quantity).toBe(25);
      expect(result.id).toBe('product-456');
      expect(result.reserved_supplier_id).toBe('supplier-456');
    });
  });

  describe('getReservations', () => {
    it('should return all reservations for a business', async () => {
      const mockReservations: ReservationResponseDto[] = [
        {
          id: 'product-1',
          name: 'Product 1',
          sku: 'SKU-001',
          reserved_quantity: 10,
          current_quantity: 50,
          min_quantity: 5,
          unit: 'pcs',
          cost: 100,
          price: 150,
          default_supplier_id: 'supplier-1',
          supplier_name: 'Supplier 1',
          reserved_supplier_id: 'supplier-1',
          reserved_supplier_name: 'Supplier 1',
        },
        {
          id: 'product-2',
          name: 'Product 2',
          sku: 'SKU-002',
          reserved_quantity: 20,
          current_quantity: 80,
          min_quantity: 10,
          unit: 'pcs',
          cost: 200,
          price: 300,
          default_supplier_id: 'supplier-2',
          supplier_name: 'Supplier 2',
          reserved_supplier_id: 'supplier-2',
          reserved_supplier_name: 'Supplier 2',
        },
      ];

      mockReservationsService.getReservations.mockResolvedValue(mockReservations);

      const result = await controller.getReservations(mockRequest);

      expect(service.getReservations).toHaveBeenCalledWith('business-123');
      expect(result).toEqual(mockReservations);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no reservations exist', async () => {
      mockReservationsService.getReservations.mockResolvedValue([]);

      const result = await controller.getReservations(mockRequest);

      expect(service.getReservations).toHaveBeenCalledWith('business-123');
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle errors and rethrow them', async () => {
      const error = new Error('Database connection failed');
      mockReservationsService.getReservations.mockRejectedValue(error);

      await expect(controller.getReservations(mockRequest)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('clearReservation', () => {
    it('should clear a product reservation', async () => {
      const productId = 'product-123';

      mockReservationsService.clearReservation.mockResolvedValue(undefined);

      const result = await controller.clearReservation(mockRequest, productId);

      expect(service.clearReservation).toHaveBeenCalledWith('business-123', productId);
      expect(result).toEqual({ message: 'Reservation cleared successfully' });
    });

    it('should clear reservation for different product', async () => {
      const productId = 'product-456';

      mockReservationsService.clearReservation.mockResolvedValue(undefined);

      const result = await controller.clearReservation(mockRequest, productId);

      expect(service.clearReservation).toHaveBeenCalledWith('business-123', productId);
      expect(result.message).toBe('Reservation cleared successfully');
    });
  });

  describe('updateReservation', () => {
    it('should update a product reservation quantity', async () => {
      const productId = 'product-123';
      const quantity = 15;

      const mockResponse: ReservationResponseDto = {
        id: productId,
        name: 'Test Product',
        sku: 'SKU-123',
        reserved_quantity: 15,
        current_quantity: 50,
        min_quantity: 5,
        unit: 'pcs',
        cost: 100,
        price: 150,
        default_supplier_id: 'supplier-123',
        supplier_name: 'Test Supplier',
        reserved_supplier_id: 'supplier-123',
        reserved_supplier_name: 'Test Supplier',
      };

      mockReservationsService.updateReservation.mockResolvedValue(mockResponse);

      const result = await controller.updateReservation(mockRequest, productId, quantity);

      expect(service.updateReservation).toHaveBeenCalledWith(
        'business-123',
        productId,
        quantity,
      );
      expect(result).toEqual(mockResponse);
      expect(result.reserved_quantity).toBe(15);
    });

    it('should update reservation with new quantity', async () => {
      const productId = 'product-789';
      const quantity = 50;

      const mockResponse: ReservationResponseDto = {
        id: productId,
        name: 'Another Product',
        sku: 'SKU-789',
        reserved_quantity: 50,
        current_quantity: 100,
        min_quantity: 10,
        unit: 'pcs',
        cost: 200,
        price: 300,
        default_supplier_id: 'supplier-789',
        supplier_name: 'Another Supplier',
        reserved_supplier_id: 'supplier-789',
        reserved_supplier_name: 'Another Supplier',
      };

      mockReservationsService.updateReservation.mockResolvedValue(mockResponse);

      const result = await controller.updateReservation(mockRequest, productId, quantity);

      expect(result.reserved_quantity).toBe(50);
      expect(result.id).toBe('product-789');
    });

    it('should handle quantity update to zero', async () => {
      const productId = 'product-123';
      const quantity = 0;

      const mockResponse: ReservationResponseDto = {
        id: productId,
        name: 'Test Product',
        sku: 'SKU-123',
        reserved_quantity: 0,
        current_quantity: 50,
        min_quantity: 5,
        unit: 'pcs',
        cost: 100,
        price: 150,
        default_supplier_id: 'supplier-123',
        supplier_name: 'Test Supplier',
        reserved_supplier_id: null,
        reserved_supplier_name: null,
      };

      mockReservationsService.updateReservation.mockResolvedValue(mockResponse);

      const result = await controller.updateReservation(mockRequest, productId, quantity);

      expect(result.reserved_quantity).toBe(0);
    });
  });

  describe('authentication and authorization', () => {
    it('should use business_id from authenticated user', async () => {
      const customRequest = {
        user: {
          id: 'user-456',
          business_id: 'business-456',
          email: 'custom@example.com',
        },
      };

      const mockReservations: ReservationResponseDto[] = [];
      mockReservationsService.getReservations.mockResolvedValue(mockReservations);

      await controller.getReservations(customRequest);

      expect(service.getReservations).toHaveBeenCalledWith('business-456');
    });

    it('should pass correct business_id for all operations', async () => {
      const dto: CreateReservationDto = {
        product_id: 'product-123',
        quantity: 10,
        supplier_id: 'supplier-123',
      };

      mockReservationsService.createReservation.mockResolvedValue({} as any);
      mockReservationsService.clearReservation.mockResolvedValue(undefined);
      mockReservationsService.updateReservation.mockResolvedValue({} as any);

      await controller.createReservation(mockRequest, dto);
      await controller.clearReservation(mockRequest, 'product-123');
      await controller.updateReservation(mockRequest, 'product-123', 10);

      expect(service.createReservation).toHaveBeenCalledWith('business-123', expect.any(Object));
      expect(service.clearReservation).toHaveBeenCalledWith('business-123', expect.any(String));
      expect(service.updateReservation).toHaveBeenCalledWith(
        'business-123',
        expect.any(String),
        expect.any(Number),
      );
    });
  });
});
