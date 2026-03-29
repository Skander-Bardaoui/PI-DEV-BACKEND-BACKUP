// src/stock/services/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async findAll(businessId: string, isActive?: boolean): Promise<Product[]> {
    const where: any = { business_id: businessId };
    if (isActive !== undefined) {
      where.is_active = isActive;
    }
    return this.productRepo.find({
      where,
      relations: ['category', 'default_supplier'],
      order: { name: 'ASC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['category', 'default_supplier'],
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findAlerts(businessId: string): Promise<Product[]> {
    const products = await this.productRepo
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.track_inventory = :track', { track: true })
      .andWhere('product.quantity <= product.min_quantity')
      .andWhere('product.is_active = :active', { active: true })
      .leftJoinAndSelect('product.category', 'category')
      .orderBy('product.name', 'ASC')
      .getMany();

    return products;
  }

  async create(businessId: string, dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create({
      ...dto,
      business_id: businessId,
    });
    return this.productRepo.save(product);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(businessId, id);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const product = await this.findOne(businessId, id);
    await this.productRepo.remove(product);
  }
}
