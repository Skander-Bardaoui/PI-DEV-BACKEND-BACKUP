import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from '../services/products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { ProductType } from '../entities/product.entity';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockProductsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findAlerts: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    findArchived: jest.fn(),
    scanProductImage: jest.fn(),
    scanServiceDescription: jest.fn(),
    generateSku: jest.fn(),
    generateBarcode: jest.fn(),
    generateLabel: jest.fn(),
    generateBulkLabels: jest.fn(),
    uploadImage: jest.fn(),
    removeImage: jest.fn(),
  };

  const mockBusinessMemberRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockBusinessRepository = {
    findOne: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      role: Role.BUSINESS_OWNER,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockBusinessMemberRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all products for a business', async () => {
      const businessId = 'business-123';
      const query = { search: 'Product', is_active: true };
      const mockProducts = [
        { id: 'product-1', name: 'Product 1', sku: 'SKU-001', price: 100 },
        { id: 'product-2', name: 'Product 2', sku: 'SKU-002', price: 200 },
      ];

      mockProductsService.findAll.mockResolvedValue(mockProducts);

      const result = await controller.findAll(businessId, query);

      expect(service.findAll).toHaveBeenCalledWith(businessId, query);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      const businessId = 'business-123';
      const productId = 'product-123';
      const mockProduct = {
        id: productId,
        name: 'Test Product',
        sku: 'SKU-001',
        price: 100,
      };

      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne(businessId, productId);

      expect(service.findOne).toHaveBeenCalledWith(businessId, productId);
      expect(result.reference).toBe('SKU-001');
    });
  });

  describe('create', () => {
    it('should create a product', async () => {
      const businessId = 'business-123';
      const dto = {
        name: 'New Product',
        reference: 'SKU-003',
        sale_price_ht: 150,
        type: ProductType.PHYSICAL,
      };

      const mockProduct = {
        id: 'product-123',
        name: 'New Product',
        sku: 'SKU-003',
        price: 150,
        type: ProductType.PHYSICAL,
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      });

      mockProductsService.create.mockResolvedValue(mockProduct);

      const result = await controller.create(businessId, dto, mockRequest);

      expect(service.create).toHaveBeenCalled();
      expect(result.reference).toBe('SKU-003');
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const businessId = 'business-123';
      const productId = 'product-123';
      const dto = {
        name: 'Updated Product',
        sale_price_ht: 200,
      };

      const existingProduct = {
        id: productId,
        type: ProductType.PHYSICAL,
      };

      const updatedProduct = {
        id: productId,
        name: 'Updated Product',
        sku: 'SKU-001',
        price: 200,
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      });

      mockProductsService.findOne.mockResolvedValue(existingProduct);
      mockProductsService.update.mockResolvedValue(updatedProduct);

      const result = await controller.update(businessId, productId, dto, mockRequest);

      expect(service.update).toHaveBeenCalled();
      expect(result.sale_price_ht).toBe(200);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a product', async () => {
      const businessId = 'business-123';
      const productId = 'product-123';

      const existingProduct = {
        id: productId,
        type: ProductType.PHYSICAL,
      };

      const deletedProduct = {
        id: productId,
        deleted_at: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      });

      mockProductsService.findOne.mockResolvedValue(existingProduct);
      mockProductsService.softDelete.mockResolvedValue(deletedProduct);

      const result = await controller.softDelete(businessId, productId, mockRequest);

      expect(service.softDelete).toHaveBeenCalledWith(businessId, productId, 'user-123');
      expect(result.deleted_at).toBeDefined();
    });
  });

  describe('generateSku', () => {
    it('should generate a SKU', async () => {
      const businessId = 'business-123';
      const dto = {
        name: 'Test Product',
        category_name: 'Electronics',
        type: ProductType.PHYSICAL,
      };

      mockProductsService.generateSku.mockResolvedValue('ELEC-TEST-0001');

      const result = await controller.generateSku(businessId, dto);

      expect(service.generateSku).toHaveBeenCalledWith(businessId, dto);
      expect(result.sku).toBe('ELEC-TEST-0001');
    });
  });
});
