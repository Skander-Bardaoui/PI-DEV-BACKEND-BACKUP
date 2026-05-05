import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { StockMovement } from '../../entities/stock-movement.entity';
import { Product, ProductType } from '../../entities/product.entity';
import { CreateStockMovementDto } from '../../dto/create-stock-movement.dto';
import { StockMovementType } from '../../enums/stock-movement-type.enum';

@Injectable()
export class StockMovementsService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async findAll(
    businessId: string,
    productId?: string,
    type?: StockMovementType,
    limit = 20,
    offset = 0,
  ): Promise<{ data: StockMovement[]; total: number }> {
    const qb = this.movementRepo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('movement.deleted_at IS NULL'); // Exclude soft-deleted items

    if (productId) {
      qb.andWhere('movement.product_id = :productId', { productId });
    }
    if (type) {
      qb.andWhere('movement.type = :type', { type });
    }

    qb.orderBy('movement.created_at', 'DESC')
      .take(limit)
      .skip(offset);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(businessId: string, id: string): Promise<StockMovement> {
    const movement = await this.movementRepo.findOne({
      where: { id, business_id: businessId, deleted_at: IsNull() },
      relations: ['product'],
    });
    if (!movement) {
      throw new NotFoundException(`Stock movement with ID ${id} not found`);
    }
    return movement;
  }

  async createManual(
    businessId: string,
    dto: CreateStockMovementDto,
  ): Promise<StockMovement> {
    // Get product
    const product = await this.productRepo.findOne({
      where: { id: dto.product_id, business_id: businessId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.product_id} not found`);
    }

    // ==================== Alaa change for service type ====================
    if (product.type === ProductType.SERVICE || product.type === ProductType.DIGITAL) {
      throw new BadRequestException('Stock movements cannot be created for service or digital products.');
    }
    // ====================================================================

    const quantityBefore = Number(product.quantity);
    let quantityChange = Number(dto.quantity);

    // Calculate new quantity based on movement type
    if (
      dto.type === StockMovementType.SORTIE_VENTE ||
      dto.type === StockMovementType.AJUSTEMENT_NEGATIF ||
      dto.type === StockMovementType.OUT
    ) {
      quantityChange = -Math.abs(quantityChange);
    } else if (
      dto.type === StockMovementType.ENTREE_ACHAT ||
      dto.type === StockMovementType.AJUSTEMENT_POSITIF ||
      dto.type === StockMovementType.IN
    ) {
      quantityChange = Math.abs(quantityChange);
    }
    // ADJUSTMENT uses the quantity as-is (can be positive or negative)

    const quantityAfter = Number((quantityBefore + quantityChange).toFixed(3));

    // Create movement
    const movement = this.movementRepo.create({
      business_id: businessId,
      product_id: dto.product_id,
      type: dto.type,
      quantity: quantityChange,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      reference_type: dto.source_type || 'MANUAL',
      reference_id: dto.source_id,
      warehouse_id: dto.warehouse_id || null,
      note: dto.note,
    });

    await this.movementRepo.save(movement);

    // Update product quantity
    product.quantity = quantityAfter;
    await this.productRepo.save(product);

    return this.findOne(businessId, movement.id);
  }

  async remove(businessId: string, id: string): Promise<void> {
    const movement = await this.findOne(businessId, id);
    
    // Only allow deletion of manual movements
    if (movement.reference_type !== 'MANUAL') {
      throw new Error('Only manual movements can be deleted');
    }

    // Reverse the movement on the product
    const product = await this.productRepo.findOne({
      where: { id: movement.product_id },
    });
    if (product) {
      product.quantity = product.quantity - movement.quantity;
      await this.productRepo.save(product);
    }

    // Soft delete by setting deleted_at
    movement.deleted_at = new Date();
    await this.movementRepo.save(movement);
  }

  async findArchived(businessId: string): Promise<StockMovement[]> {
    return this.movementRepo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('movement.deleted_at IS NOT NULL')
      .orderBy('movement.deleted_at', 'DESC')
      .getMany();
  }

  async restore(businessId: string, id: string): Promise<StockMovement> {
    const movement = await this.movementRepo
      .createQueryBuilder('movement')
      .where('movement.id = :id', { id })
      .andWhere('movement.business_id = :businessId', { businessId })
      .getOne();

    if (!movement) {
      throw new NotFoundException(`Stock movement with ID ${id} not found`);
    }

    if (!movement.deleted_at) {
      throw new BadRequestException('Stock movement is not deleted');
    }

    movement.deleted_at = null;
    await this.movementRepo.save(movement);
    return this.findOne(businessId, id);
  }
}
