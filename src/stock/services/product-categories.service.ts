// src/stock/services/product-categories.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from '../entities/product-category.entity';
import { CreateProductCategoryDto } from '../dto/create-product-category.dto';
import { UpdateProductCategoryDto } from '../dto/update-product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  async findAll(businessId: string, isActive?: boolean): Promise<ProductCategory[]> {
    const where: any = { business_id: businessId };
    if (isActive !== undefined) {
      where.is_active = isActive;
    }
    return this.categoryRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(businessId: string, id: string): Promise<ProductCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id, business_id: businessId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(businessId: string, dto: CreateProductCategoryDto): Promise<ProductCategory> {
    const category = this.categoryRepo.create({
      ...dto,
      business_id: businessId,
    });
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
    await this.categoryRepo.remove(category);
  }
}
