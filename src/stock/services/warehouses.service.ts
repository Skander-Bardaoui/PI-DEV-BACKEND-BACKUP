import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';
import { Product } from '../entities/product.entity';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async findAll(businessId: string, isActive?: boolean): Promise<Warehouse[]> {
    const where: any = { business_id: businessId };
    if (isActive !== undefined) {
      where.is_active = isActive;
    }
    return this.warehouseRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOne({
      where: { id, business_id: businessId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return warehouse;
  }

  async create(businessId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    // Check if code already exists for this business
    const existing = await this.warehouseRepo.findOne({
      where: { business_id: businessId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Warehouse with code ${dto.code} already exists`);
    }

    const warehouse = this.warehouseRepo.create({
      ...dto,
      business_id: businessId,
    });
    return this.warehouseRepo.save(warehouse);
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(businessId, id);

    // Check if code is being changed and if it conflicts
    if (dto.code && dto.code !== warehouse.code) {
      const existing = await this.warehouseRepo.findOne({
        where: { business_id: businessId, code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(`Warehouse with code ${dto.code} already exists`);
      }
    }

    Object.assign(warehouse, dto);
    return this.warehouseRepo.save(warehouse);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const warehouse = await this.findOne(businessId, id);
    await this.warehouseRepo.remove(warehouse);
  }

  async getWarehouseStock(businessId: string, warehouseId: string): Promise<Product[]> {
    // Verify warehouse belongs to business
    await this.findOne(businessId, warehouseId);

    // Get all products assigned to this warehouse
    const products = await this.productRepo.find({
      where: {
        business_id: businessId,
        warehouse_id: warehouseId,
      },
      relations: ['category'],
      order: { name: 'ASC' },
    });

    return products;
  }
}
