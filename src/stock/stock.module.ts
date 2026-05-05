import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { Warehouse } from './entities/warehouse.entity';
import { Business } from '../businesses/entities/business.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { User } from '../users/entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CommonModule } from '../common/common.module';
import { StockMovementsService } from './services/stock-movements/stock-movements.service';
import { ProductCategoriesService } from './services/product-categories.service';
import { ProductsService } from './services/products.service';
import { WarehousesService } from './services/warehouses.service';
// ==================== Alaa change for stock dashboard ====================
import { StockDashboardService } from './services/stock-dashboard.service';
// ====================================================================
// ==================== Alaa change for product reservations ====================
import { ProductReservationsService } from './services/product-reservations.service';
// ====================================================================
import { ProductCategoriesController } from './controllers/product-categories.controller';
import { ProductsController } from './controllers/products.controller';
import { StockMovementsController } from './controllers/stock-movements.controller';
import { WarehousesController } from './controllers/warehouses.controller';
// ==================== Alaa change for stock dashboard ====================
import { StockDashboardController } from './controllers/stock-dashboard.controller';
// ====================================================================
// ==================== Alaa change for product reservations ====================
import { ProductReservationsController } from './controllers/product-reservations.controller';
// ====================================================================

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, StockMovement, Warehouse, Business, BusinessMember, User, Tenant]),
    CommonModule,
  ],
  controllers: [ProductCategoriesController, ProductsController, StockMovementsController, WarehousesController, StockDashboardController, ProductReservationsController],
  exports: [TypeOrmModule, StockMovementsService, ProductsService, WarehousesService],
  providers: [StockMovementsService, ProductCategoriesService, ProductsService, WarehousesService, StockDashboardService, ProductReservationsService],
})
export class StockModule {}

