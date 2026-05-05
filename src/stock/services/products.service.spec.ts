import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product, ProductType } from '../entities/product.entity';
import { Business } from '../../businesses/entities/business.entity';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepo: Repository<Product>;

  const mockProductRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockBusinessRepository = {
    findOne: jest.fn(),
  };

  const mockMemberRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      const mockProduct = {
        id: 'product-123',
        business_id: 'business-123',
        name: 'Test Product',
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const result = await service.findOne('business-123', 'product-123');

      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'product-123', business_id: 'business-123' },
        relations: ['category', 'default_supplier'],
      });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('business-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a product', async () => {
      const dto = {
        name: 'New Product',
        sku: 'SKU-001',
        price: 100,
        type: ProductType.PHYSICAL,
      };

      const mockProduct = {
        id: 'product-123',
        business_id: 'business-123',
        ...dto,
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: 'BUSINESS_OWNER',
      });

      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);

      const result = await service.create('business-123', dto, 'user-123');

      expect(productRepo.create).toHaveBeenCalled();
      expect(productRepo.save).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const dto = {
        name: 'Updated Product',
        price: 150,
      };

      const existingProduct = {
        id: 'product-123',
        business_id: 'business-123',
        name: 'Old Product',
        price: 100,
        type: ProductType.PHYSICAL,
      };

      const updatedProduct = {
        ...existingProduct,
        ...dto,
      };

      mockProductRepository.findOne.mockResolvedValue(existingProduct);
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: 'BUSINESS_OWNER',
      });
      mockProductRepository.save.mockResolvedValue(updatedProduct);

      const result = await service.update('business-123', 'product-123', dto, 'user-123');

      expect(productRepo.save).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalled();
      expect(result.name).toBe('Updated Product');
    });
  });

  describe('generateSku', () => {
    it('should generate SKU for physical product', async () => {
      const dto = {
        name: 'Test Product',
        category_name: 'Electronics',
        brand: 'Samsung',
        type: ProductType.PHYSICAL,
      };

      mockProductRepository.count.mockResolvedValue(5);

      const result = await service.generateSku('business-123', dto);

      expect(result).toContain('ELEC');
      expect(result).toContain('SAMS');
    });

    it('should generate SKU for service', async () => {
      const dto = {
        name: 'Consulting Service',
        category_name: 'Consulting',
        type: ProductType.SERVICE,
      };

      mockProductRepository.count.mockResolvedValue(2);

      const result = await service.generateSku('business-123', dto);

      expect(result).toContain('SRV-');
      expect(result).toContain('CONS');
    });
  });
});
