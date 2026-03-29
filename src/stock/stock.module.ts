import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockMovementsService } from './services/stock-movements/stock-movements.service';
import { ProductCategoriesService } from './services/product-categories.service';
import { ProductsService } from './services/products.service';
import { ProductCategoriesController } from './controllers/product-categories.controller';
import { ProductsController } from './controllers/products.controller';
import { StockMovementsController } from './controllers/stock-movements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, StockMovement]),
  ],
  controllers: [ProductCategoriesController, ProductsController, StockMovementsController],
  exports: [TypeOrmModule],
  providers: [StockMovementsService, ProductCategoriesService, ProductsService],
})
export class StockModule {}

