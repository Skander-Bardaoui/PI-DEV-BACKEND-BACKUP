// ==================== Alaa change for stock dashboard ====================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductType } from '../entities/product.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import {
  StockDashboardResponseDto,
  StockDashboardSummaryDto,
  LowStockProductDto,
  RecentMovementDto,
  MovementsChartDto,
  StockForecastDto,
} from '../dto/stock-dashboard.dto';

@Injectable()
export class StockDashboardService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepository: Repository<ProductCategory>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
  ) {}

  async getDashboard(businessId: string): Promise<StockDashboardResponseDto> {
    const [
      summary,
      low_stock_products,
      recent_movements,
      movements_chart,
      stock_forecast,
    ] = await Promise.all([
      this.getSummary(businessId),
      this.getLowStockProducts(businessId),
      this.getRecentMovements(businessId),
      this.getMovementsChart(businessId),
      this.getStockForecast(businessId),
    ]);

    return {
      summary,
      low_stock_products,
      recent_movements,
      movements_chart,
      stock_forecast,
    };
  }

  async getProductsDashboard(businessId: string): Promise<StockDashboardResponseDto> {
    const [
      summary,
      low_stock_products,
      recent_movements,
      movements_chart,
      stock_forecast,
    ] = await Promise.all([
      this.getProductsSummary(businessId),
      this.getLowStockProducts(businessId),
      this.getProductMovements(businessId),
      this.getProductMovementsChart(businessId),
      this.getStockForecast(businessId),
    ]);

    return {
      summary,
      low_stock_products,
      recent_movements,
      movements_chart,
      stock_forecast,
    };
  }

  async getServicesDashboard(businessId: string): Promise<StockDashboardResponseDto> {
    const [
      summary,
      recent_movements,
      movements_chart,
    ] = await Promise.all([
      this.getServicesSummary(businessId),
      this.getServiceActivities(businessId),
      this.getServiceActivitiesChart(businessId),
    ]);

    return {
      summary,
      low_stock_products: [],
      recent_movements,
      movements_chart,
      stock_forecast: [],
    };
  }

  private async getSummary(businessId: string): Promise<StockDashboardSummaryDto> {
    // Count active physical products
    const total_products = await this.productRepository.count({
      where: {
        business_id: businessId,
        is_active: true,
        type: ProductType.PHYSICAL,
      },
    });

    // Count active service products
    const total_services = await this.productRepository.count({
      where: {
        business_id: businessId,
        is_active: true,
        type: ProductType.SERVICE,
      },
    });

    // Count low stock products (quantity <= min_quantity AND track_inventory = true)
    const low_stock_count = await this.productRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.track_inventory = :trackInventory', { trackInventory: true })
      .andWhere('product.quantity <= product.min_quantity')
      .getCount();

    // Count out of stock products (quantity = 0 AND track_inventory = true)
    const out_of_stock_count = await this.productRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.track_inventory = :trackInventory', { trackInventory: true })
      .andWhere('product.quantity = :quantity', { quantity: 0 })
      .getCount();

    // Count active categories
    const total_categories = await this.categoryRepository.count({
      where: {
        business_id: businessId,
        is_active: true,
      },
    });

    // Count total movements
    const total_movements = await this.movementRepository.count({
      where: {
        business_id: businessId,
      },
    });

    // Calculate total stock value (sum of quantity * cost for active physical products)
    const stockValueResult = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.quantity * product.cost)', 'total_value')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.type = :type', { type: ProductType.PHYSICAL })
      .andWhere('product.cost IS NOT NULL')
      .getRawOne();

    const total_stock_value = parseFloat(stockValueResult?.total_value || '0');

    return {
      total_products,
      total_services,
      low_stock_count,
      out_of_stock_count,
      total_categories,
      total_movements,
      total_stock_value,
    };
  }

  private async getLowStockProducts(businessId: string): Promise<LowStockProductDto[]> {
    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.track_inventory = :trackInventory', { trackInventory: true })
      .andWhere('product.quantity <= product.min_quantity')
      .orderBy('(product.quantity / NULLIF(product.min_quantity, 0))', 'ASC')
      .limit(5)
      .getMany();

    return products.map((product) => {
      const stock_percentage = product.min_quantity > 0
        ? Math.min((product.quantity / product.min_quantity) * 100, 100)
        : 100;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: parseFloat(product.quantity.toString()),
        min_quantity: parseFloat(product.min_quantity.toString()),
        unit: product.unit,
        category_name: product.category?.name || null,
        stock_percentage: Math.round(stock_percentage),
      };
    });
  }

  private async getRecentMovements(businessId: string): Promise<RecentMovementDto[]> {
    const movements = await this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .orderBy('movement.created_at', 'DESC')
      .limit(8)
      .getMany();

    return movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: parseFloat(movement.quantity.toString()),
      created_at: movement.created_at,
      product_name: movement.product?.name || 'Unknown Product',
      product_sku: movement.product?.sku || '',
      reference: movement.reference,
    }));
  }

  private async getMovementsChart(businessId: string): Promise<MovementsChartDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rawData = await this.movementRepository
      .createQueryBuilder('movement')
      .select("DATE_TRUNC('day', movement.created_at)", 'date')
      .addSelect(
        `SUM(CASE WHEN movement.type = 'ENTREE_ACHAT' THEN movement.quantity ELSE 0 END)`,
        'entrees',
      )
      .addSelect(
        `SUM(CASE WHEN movement.type = 'SORTIE_VENTE' THEN ABS(movement.quantity) ELSE 0 END)`,
        'sorties',
      )
      .addSelect(
        `SUM(CASE WHEN movement.type IN ('AJUSTEMENT_POSITIF', 'AJUSTEMENT_NEGATIF') THEN ABS(movement.quantity) ELSE 0 END)`,
        'ajustements',
      )
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('movement.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("DATE_TRUNC('day', movement.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rawData.map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      entrees: parseFloat(row.entrees || '0'),
      sorties: parseFloat(row.sorties || '0'),
      ajustements: parseFloat(row.ajustements || '0'),
    }));
  }

  private async getStockForecast(businessId: string): Promise<StockForecastDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get products with their average daily consumption
    const productsWithConsumption = await this.productRepository
      .createQueryBuilder('product')
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.sku', 'sku')
      .addSelect('product.unit', 'unit')
      .addSelect('product.quantity', 'current_quantity')
      .addSelect(
        `COALESCE(
          (SELECT SUM(ABS(sm.quantity)) / 30.0
           FROM stock_movements sm
           WHERE sm.product_id = product.id
           AND sm.type = 'SORTIE_VENTE'
           AND sm.created_at >= :thirtyDaysAgo),
          0
        )`,
        'avg_daily_consumption',
      )
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.track_inventory = :trackInventory', { trackInventory: true })
      .setParameter('thirtyDaysAgo', thirtyDaysAgo)
      .getRawMany();

    // Filter and calculate days remaining
    const forecast = productsWithConsumption
      .map((row) => {
        const current_quantity = parseFloat(row.current_quantity);
        const avg_daily_consumption = parseFloat(row.avg_daily_consumption);
        
        let days_remaining: number | null = null;
        let risk_level: 'CRITICAL' | 'WARNING' | 'OK' = 'OK';

        if (current_quantity === 0) {
          days_remaining = null;
          risk_level = 'CRITICAL';
        } else if (avg_daily_consumption > 0) {
          days_remaining = Math.round(current_quantity / avg_daily_consumption);
          
          if (days_remaining <= 7) {
            risk_level = 'CRITICAL';
          } else if (days_remaining <= 30) {
            risk_level = 'WARNING';
          } else {
            risk_level = 'OK';
          }
        }

        return {
          id: row.id,
          name: row.name,
          sku: row.sku,
          unit: row.unit,
          current_quantity,
          avg_daily_consumption,
          days_remaining,
          risk_level,
        };
      })
      .filter((item) => item.avg_daily_consumption > 0 || item.current_quantity === 0)
      .sort((a, b) => {
        // Sort by days_remaining ASC, nulls last
        if (a.days_remaining === null && b.days_remaining === null) return 0;
        if (a.days_remaining === null) return 1;
        if (b.days_remaining === null) return -1;
        return a.days_remaining - b.days_remaining;
      })
      .slice(0, 8);

    return forecast;
  }

  // Products-specific methods
  private async getProductsSummary(businessId: string): Promise<StockDashboardSummaryDto> {
    const total_products = await this.productRepository.count({
      where: { business_id: businessId, is_active: true, type: ProductType.PHYSICAL },
    });

    const low_stock_count = await this.productRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.type = :type', { type: ProductType.PHYSICAL })
      .andWhere('product.track_inventory = :trackInventory', { trackInventory: true })
      .andWhere('product.quantity <= product.min_quantity')
      .getCount();

    const total_categories = await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.business_id = :businessId', { businessId })
      .andWhere('category.is_active = :isActive', { isActive: true })
      .andWhere('category.category_type = :categoryType', { categoryType: 'PRODUCT' })
      .getCount();

    const total_movements = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('product.type = :type', { type: ProductType.PHYSICAL })
      .getCount();

    const stockValueResult = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.quantity * product.cost)', 'total_value')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.type = :type', { type: ProductType.PHYSICAL })
      .andWhere('product.cost IS NOT NULL')
      .getRawOne();

    const total_stock_value = parseFloat(stockValueResult?.total_value || '0');

    return {
      total_products,
      total_services: 0,
      low_stock_count,
      out_of_stock_count: 0,
      total_categories,
      total_movements,
      total_stock_value,
    };
  }

  private async getProductMovements(businessId: string): Promise<RecentMovementDto[]> {
    const movements = await this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('product.type = :type', { type: ProductType.PHYSICAL })
      .orderBy('movement.created_at', 'DESC')
      .limit(8)
      .getMany();

    return movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: parseFloat(movement.quantity.toString()),
      created_at: movement.created_at,
      product_name: movement.product?.name || 'Unknown Product',
      product_sku: movement.product?.sku || '',
      reference: movement.reference,
    }));
  }

  private async getProductMovementsChart(businessId: string): Promise<MovementsChartDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rawData = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.product', 'product')
      .select("DATE_TRUNC('day', movement.created_at)", 'date')
      .addSelect(
        `SUM(CASE WHEN movement.type = 'ENTREE_ACHAT' THEN movement.quantity ELSE 0 END)`,
        'entrees',
      )
      .addSelect(
        `SUM(CASE WHEN movement.type = 'SORTIE_VENTE' THEN ABS(movement.quantity) ELSE 0 END)`,
        'sorties',
      )
      .addSelect(
        `SUM(CASE WHEN movement.type IN ('AJUSTEMENT_POSITIF', 'AJUSTEMENT_NEGATIF') THEN ABS(movement.quantity) ELSE 0 END)`,
        'ajustements',
      )
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('product.type = :type', { type: ProductType.PHYSICAL })
      .andWhere('movement.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("DATE_TRUNC('day', movement.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rawData.map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      entrees: parseFloat(row.entrees || '0'),
      sorties: parseFloat(row.sorties || '0'),
      ajustements: parseFloat(row.ajustements || '0'),
    }));
  }

  // Services-specific methods
  private async getServicesSummary(businessId: string): Promise<StockDashboardSummaryDto> {
    const total_services = await this.productRepository.count({
      where: { business_id: businessId, is_active: true, type: ProductType.SERVICE },
    });

    const total_categories = await this.categoryRepository
      .createQueryBuilder('category')
      .where('category.business_id = :businessId', { businessId })
      .andWhere('category.is_active = :isActive', { isActive: true })
      .andWhere('category.category_type = :categoryType', { categoryType: 'SERVICE' })
      .getCount();

    const total_movements = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('product.type = :type', { type: ProductType.SERVICE })
      .getCount();

    const serviceValueResult = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.price)', 'total_value')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_active = :isActive', { isActive: true })
      .andWhere('product.type = :type', { type: ProductType.SERVICE })
      .andWhere('product.price IS NOT NULL')
      .getRawOne();

    const total_stock_value = parseFloat(serviceValueResult?.total_value || '0');

    return {
      total_products: 0,
      total_services,
      low_stock_count: 0,
      out_of_stock_count: 0,
      total_categories,
      total_movements,
      total_stock_value,
    };
  }

  private async getServiceActivities(businessId: string): Promise<RecentMovementDto[]> {
    const movements = await this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('product.type = :type', { type: ProductType.SERVICE })
      .orderBy('movement.created_at', 'DESC')
      .limit(8)
      .getMany();

    return movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: parseFloat(movement.quantity.toString()),
      created_at: movement.created_at,
      product_name: movement.product?.name || 'Unknown Service',
      product_sku: movement.product?.sku || '',
      reference: movement.reference,
    }));
  }

  private async getServiceActivitiesChart(businessId: string): Promise<MovementsChartDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rawData = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.product', 'product')
      .select("DATE_TRUNC('day', movement.created_at)", 'date')
      .addSelect(
        `SUM(CASE WHEN movement.type IN ('ENTREE_ACHAT', 'IN') THEN movement.quantity ELSE 0 END)`,
        'entrees',
      )
      .addSelect(
        `SUM(CASE WHEN movement.type IN ('SORTIE_VENTE', 'OUT') THEN ABS(movement.quantity) ELSE 0 END)`,
        'sorties',
      )
      .addSelect('0', 'ajustements')
      .where('movement.business_id = :businessId', { businessId })
      .andWhere('product.type = :type', { type: ProductType.SERVICE })
      .andWhere('movement.created_at >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("DATE_TRUNC('day', movement.created_at)")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rawData.map((row) => ({
      date: new Date(row.date).toISOString().split('T')[0],
      entrees: parseFloat(row.entrees || '0'),
      sorties: parseFloat(row.sorties || '0'),
      ajustements: parseFloat(row.ajustements || '0'),
    }));
  }
}
// ====================================================================
