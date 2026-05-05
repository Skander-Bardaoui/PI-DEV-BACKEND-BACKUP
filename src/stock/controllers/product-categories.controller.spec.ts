import { Test, TestingModule } from '@nestjs/testing';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductCategoriesService } from '../services/product-categories.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessMember } from '../../businesses/entities/business-member.entity';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';

describe('ProductCategoriesController', () => {
  let controller: ProductCategoriesController;
  let service: ProductCategoriesService;

  const mockCategoriesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findArchived: jest.fn(),
    restore: jest.fn(),
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
      controllers: [ProductCategoriesController],
      providers: [
        {
          provide: ProductCategoriesService,
          useValue: mockCategoriesService,
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

    controller = module.get<ProductCategoriesController>(ProductCategoriesController);
    service = module.get<ProductCategoriesService>(ProductCategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const businessId = 'business-123';
      const query = { search: 'Electronics' };
      const mockCategories = [
        { id: 'cat-1', name: 'Electronics', code: 'ELEC' },
        { id: 'cat-2', name: 'Electronic Parts', code: 'EPAR' },
      ];

      mockCategoriesService.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll(businessId, query);

      expect(service.findAll).toHaveBeenCalledWith(businessId, query);
      expect(result).toEqual(mockCategories);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      const businessId = 'business-123';
      const categoryId = 'category-123';
      const mockCategory = {
        id: categoryId,
        name: 'Electronics',
        code: 'ELEC',
      };

      mockCategoriesService.findOne.mockResolvedValue(mockCategory);

      const result = await controller.findOne(businessId, categoryId);

      expect(service.findOne).toHaveBeenCalledWith(businessId, categoryId);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const businessId = 'business-123';
      const dto = {
        name: 'Electronics',
        code: 'ELEC',
        category_type: 'PRODUCT',
      };

      const mockCategory = {
        id: 'category-123',
        ...dto,
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      });

      mockCategoriesService.create.mockResolvedValue(mockCategory);

      const result = await controller.create(businessId, dto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(businessId, dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const businessId = 'business-123';
      const categoryId = 'category-123';
      const dto = {
        name: 'Updated Electronics',
      };

      const existingCategory = {
        id: categoryId,
        category_type: 'PRODUCT',
      };

      const updatedCategory = {
        id: categoryId,
        name: 'Updated Electronics',
        category_type: 'PRODUCT',
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      });

      mockCategoriesService.findOne.mockResolvedValue(existingCategory);
      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update(businessId, categoryId, dto, mockRequest);

      expect(service.update).toHaveBeenCalledWith(businessId, categoryId, dto);
      expect(result).toEqual(updatedCategory);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      const businessId = 'business-123';
      const categoryId = 'category-123';

      const existingCategory = {
        id: categoryId,
        category_type: 'PRODUCT',
      };

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      });

      mockCategoriesService.findOne.mockResolvedValue(existingCategory);
      mockCategoriesService.remove.mockResolvedValue(undefined);

      await controller.remove(businessId, categoryId, mockRequest);

      expect(service.remove).toHaveBeenCalledWith(businessId, categoryId);
    });
  });

  describe('restore', () => {
    it('should restore a deleted category', async () => {
      const businessId = 'business-123';
      const categoryId = 'category-123';

      const restoredCategory = {
        id: categoryId,
        name: 'Electronics',
        deleted_at: null,
      };

      mockCategoriesService.restore.mockResolvedValue(restoredCategory);

      const result = await controller.restore(businessId, categoryId);

      expect(service.restore).toHaveBeenCalledWith(businessId, categoryId);
      expect(result).toEqual(restoredCategory);
    });
  });
});
