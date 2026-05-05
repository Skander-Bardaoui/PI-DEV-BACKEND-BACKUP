import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategoriesService } from './product-categories.service';
import { ProductCategory } from '../entities/product-category.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProductCategoriesService', () => {
  let service: ProductCategoriesService;
  let categoryRepo: Repository<ProductCategory>;

  const mockCategoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductCategoriesService,
        {
          provide: getRepositoryToken(ProductCategory),
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<ProductCategoriesService>(ProductCategoriesService);
    categoryRepo = module.get<Repository<ProductCategory>>(getRepositoryToken(ProductCategory));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      const mockCategory = {
        id: 'category-123',
        business_id: 'business-123',
        name: 'Electronics',
        deleted_at: null,
      };

      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne('business-123', 'category-123');

      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('business-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const dto = {
        name: 'Electronics',
        code: 'ELEC',
        category_type: 'PRODUCT',
      };

      const mockCategory = {
        id: 'category-123',
        business_id: 'business-123',
        ...dto,
      };

      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      const result = await service.create('business-123', dto);

      expect(categoryRepo.create).toHaveBeenCalled();
      expect(categoryRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockCategory);
    });

    it('should default category_type to PRODUCT if not specified', async () => {
      const dto = {
        name: 'General',
        code: 'GEN',
      };

      const mockCategory = {
        id: 'category-123',
        business_id: 'business-123',
        ...dto,
        category_type: 'PRODUCT',
      };

      mockCategoryRepository.create.mockReturnValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(mockCategory);

      const result = await service.create('business-123', dto);

      expect(result.category_type).toBe('PRODUCT');
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const dto = {
        name: 'Updated Electronics',
      };

      const existingCategory = {
        id: 'category-123',
        business_id: 'business-123',
        name: 'Electronics',
        deleted_at: null,
      };

      const updatedCategory = {
        ...existingCategory,
        ...dto,
      };

      mockCategoryRepository.findOne.mockResolvedValue(existingCategory);
      mockCategoryRepository.save.mockResolvedValue(updatedCategory);

      const result = await service.update('business-123', 'category-123', dto);

      expect(categoryRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Electronics');
    });
  });

  describe('remove', () => {
    it('should soft delete a category', async () => {
      const mockCategory = {
        id: 'category-123',
        business_id: 'business-123',
        name: 'Electronics',
        deleted_at: null,
      };

      const deletedCategory = {
        ...mockCategory,
        deleted_at: expect.any(Date),
      };

      mockCategoryRepository.findOne.mockResolvedValue(mockCategory);
      mockCategoryRepository.save.mockResolvedValue(deletedCategory);

      await service.remove('business-123', 'category-123');

      expect(categoryRepo.save).toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore a deleted category', async () => {
      const deletedCategory = {
        id: 'category-123',
        business_id: 'business-123',
        name: 'Electronics',
        deleted_at: new Date(),
      };

      const restoredCategory = {
        ...deletedCategory,
        deleted_at: null,
      };

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(deletedCategory),
      };

      mockCategoryRepository.createQueryBuilder.mockReturnValue(qb);
      mockCategoryRepository.save.mockResolvedValue(restoredCategory);
      mockCategoryRepository.findOne.mockResolvedValue(restoredCategory);

      const result = await service.restore('business-123', 'category-123');

      expect(result.deleted_at).toBeNull();
    });

    it('should throw BadRequestException if category is not deleted', async () => {
      const activeCategory = {
        id: 'category-123',
        business_id: 'business-123',
        name: 'Electronics',
        deleted_at: null,
      };

      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(activeCategory),
      };

      mockCategoryRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.restore('business-123', 'category-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
