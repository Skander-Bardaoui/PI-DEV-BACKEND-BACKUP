// ==================== Alaa change for product reservations ====================
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { CreateReservationDto, ReservationResponseDto } from '../dto/product-reservation.dto';

@Injectable()
export class ProductReservationsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async createReservation(
    businessId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    const product = await this.productRepository.findOne({
      where: {
        id: dto.product_id,
        business_id: businessId,
        is_active: true,
      },
      relations: ['default_supplier'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Update reserved quantity and supplier
    product.reserved_quantity = parseFloat(product.reserved_quantity.toString()) + dto.quantity;
    product.reserved_supplier_id = dto.supplier_id || product.default_supplier_id;
    await this.productRepository.save(product);

    // Fetch supplier name if reserved_supplier_id is set
    let reservedSupplierName = null;
    if (product.reserved_supplier_id) {
      const supplierResult = await this.productRepository.query(
        'SELECT name FROM suppliers WHERE id = $1',
        [product.reserved_supplier_id],
      );
      reservedSupplierName = supplierResult[0]?.name || null;
    }

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      reserved_quantity: parseFloat(product.reserved_quantity.toString()),
      current_quantity: parseFloat(product.quantity.toString()),
      min_quantity: parseFloat(product.min_quantity.toString()),
      unit: product.unit,
      cost: product.cost ? parseFloat(product.cost.toString()) : null,
      price: parseFloat(product.price.toString()),
      default_supplier_id: product.default_supplier_id,
      supplier_name: product.default_supplier?.name || null,
      reserved_supplier_id: product.reserved_supplier_id,
      reserved_supplier_name: reservedSupplierName,
    };
  }

  async getReservations(businessId: string): Promise<ReservationResponseDto[]> {
    try {
      const products = await this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.default_supplier', 'supplier')
        .where('product.business_id = :businessId', { businessId })
        .andWhere('product.is_active = :isActive', { isActive: true })
        .andWhere('product.reserved_quantity > 0')
        .orderBy('product.reserved_quantity', 'DESC')
        .getMany();

      // Fetch reserved supplier names
      const results = await Promise.all(
        products.map(async (product) => {
          let reservedSupplierName = null;
          if (product.reserved_supplier_id) {
            const supplierResult = await this.productRepository.query(
              'SELECT name FROM suppliers WHERE id = $1',
              [product.reserved_supplier_id],
            );
            reservedSupplierName = supplierResult[0]?.name || null;
          }

          return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            reserved_quantity: parseFloat(product.reserved_quantity.toString()),
            current_quantity: parseFloat(product.quantity.toString()),
            min_quantity: parseFloat(product.min_quantity.toString()),
            unit: product.unit,
            cost: product.cost ? parseFloat(product.cost.toString()) : null,
            price: parseFloat(product.price.toString()),
            default_supplier_id: product.default_supplier_id,
            supplier_name: product.default_supplier?.name || null,
            reserved_supplier_id: product.reserved_supplier_id,
            reserved_supplier_name: reservedSupplierName,
          };
        }),
      );

      return results;
    } catch (error) {
      console.error('Error in getReservations:', error);
      throw error;
    }
  }

  async clearReservation(
    businessId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        business_id: businessId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.reserved_quantity = 0;
    product.reserved_supplier_id = null;
    await this.productRepository.save(product);
  }

  async updateReservation(
    businessId: string,
    productId: string,
    quantity: number,
  ): Promise<ReservationResponseDto> {
    const product = await this.productRepository.findOne({
      where: {
        id: productId,
        business_id: businessId,
        is_active: true,
      },
      relations: ['default_supplier'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    product.reserved_quantity = quantity;
    await this.productRepository.save(product);

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      reserved_quantity: parseFloat(product.reserved_quantity.toString()),
      current_quantity: parseFloat(product.quantity.toString()),
      min_quantity: parseFloat(product.min_quantity.toString()),
      unit: product.unit,
      cost: product.cost ? parseFloat(product.cost.toString()) : null,
      price: parseFloat(product.price.toString()),
      default_supplier_id: product.default_supplier_id,
      supplier_name: product.default_supplier?.name || null,
    };
  }
}
// ====================================================================
