// src/stock/services/product-categories.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, IsNull } from 'typeorm';
import { ProductCategory } from '../entities/product-category.entity';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';
import { UpdateProductCategoryDto } from '../dto/update-product-category.dto';
import { QueryCategoriesDto, CategorySortBy } from '../dto/query-categories.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  async findAll(businessId: string, query: QueryCategoriesDto = {}): Promise<ProductCategory[]> {
    const qb: SelectQueryBuilder<ProductCategory> = this.categoryRepo
      .createQueryBuilder('category')
      .where('category.business_id = :businessId', { businessId })
      .andWhere('category.deleted_at IS NULL'); // Exclude soft-deleted items

    // Search filter
    if (query.search) {
      qb.andWhere(
        '(LOWER(category.name) LIKE LOWER(:search) OR LOWER(category.code) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    // Active status filter
    if (query.is_active !== undefined) {
      qb.andWhere('category.is_active = :isActive', { isActive: query.is_active });
    }

    // Parent category filter
    if (query.parent_id) {
      qb.andWhere('category.parent_id = :parentId', { parentId: query.parent_id });
    }

    // Root only filter
    if (query.root_only) {
      qb.andWhere('category.parent_id IS NULL');
    }

    // Has products filter
    if (query.has_products) {
      qb.innerJoin('category.products', 'product');
    }

    // ==================== Alaa change for service type ====================
    // Category type filter
    if (query.category_type) {
      qb.andWhere('category.category_type = :categoryType', { categoryType: query.category_type });
    }
    // ====================================================================

    // Sorting
    const sortBy = query.sort_by || CategorySortBy.SORT_ORDER;
    const sortOrder = query.sort_order || 'ASC';

    switch (sortBy) {
      case CategorySortBy.NAME:
        qb.orderBy('category.name', sortOrder);
        break;
      case CategorySortBy.SORT_ORDER:
        qb.orderBy('category.sort_order', sortOrder);
        break;
      case CategorySortBy.CREATED_AT:
        qb.orderBy('category.created_at', sortOrder);
        break;
      default:
        qb.orderBy('category.sort_order', 'ASC');
    }

    return qb.getMany();
  }

  async findOne(businessId: string, id: string): Promise<ProductCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id, business_id: businessId, deleted_at: IsNull() },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(businessId: string, dto: CreateProductCategoryDto): Promise<ProductCategory> {
    // ==================== Alaa change for service type ====================
    const category = this.categoryRepo.create({
      ...dto,
      business_id: businessId,
      category_type: dto.category_type || 'PRODUCT', // Default to PRODUCT if not specified
    });
    // ====================================================================
    return this.categoryRepo.save(category);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateProductCategoryDto,
  ): Promise<ProductCategory> {
    const category = await this.findOne(businessId, id);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const category = await this.findOne(businessId, id);
    // Soft delete by setting deleted_at
    category.deleted_at = new Date();
    await this.categoryRepo.save(category);
  }

  async findArchived(businessId: string): Promise<ProductCategory[]> {
    return this.categoryRepo
      .createQueryBuilder('category')
      .where('category.business_id = :businessId', { businessId })
      .andWhere('category.deleted_at IS NOT NULL')
      .orderBy('category.deleted_at', 'DESC')
      .getMany();
  }

  async restore(businessId: string, id: string): Promise<ProductCategory> {
    const category = await this.categoryRepo
      .createQueryBuilder('category')
      .where('category.id = :id', { id })
      .andWhere('category.business_id = :businessId', { businessId })
      .getOne();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (!category.deleted_at) {
      throw new BadRequestException('Category is not deleted');
    }

    category.deleted_at = null;
    await this.categoryRepo.save(category);
    return this.findOne(businessId, id);
  }
}
