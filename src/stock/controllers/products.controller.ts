// src/stock/controllers/products.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';

@Controller('businesses/:businessId/products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Transform frontend DTO to backend DTO
  private transformFrontendDto(frontendDto: any): any {
    const backendDto: any = { ...frontendDto };
    
    // Map frontend field names to backend field names
    if (frontendDto.reference !== undefined) {
      backendDto.sku = frontendDto.reference;
      delete backendDto.reference;
    }
    if (frontendDto.sale_price_ht !== undefined) {
      backendDto.price = frontendDto.sale_price_ht;
      delete backendDto.sale_price_ht;
    }
    if (frontendDto.purchase_price_ht !== undefined) {
      backendDto.cost = frontendDto.purchase_price_ht;
      delete backendDto.purchase_price_ht;
    }
    if (frontendDto.current_stock !== undefined) {
      backendDto.quantity = frontendDto.current_stock;
      delete backendDto.current_stock;
    }
    if (frontendDto.min_stock_threshold !== undefined) {
      backendDto.min_quantity = frontendDto.min_stock_threshold;
      delete backendDto.min_stock_threshold;
    }
    if (frontendDto.is_stockable !== undefined) {
      backendDto.track_inventory = frontendDto.is_stockable;
      delete backendDto.is_stockable;
    }
    
    return backendDto;
  }

  // Transform backend entity to frontend format
  private transformToFrontend(product: any): any {
    return {
      ...product,
      reference: product.sku,
      sale_price_ht: parseFloat(product.price) || 0,
      purchase_price_ht: parseFloat(product.cost) || 0,
      current_stock: parseFloat(product.quantity) || 0,
      min_stock_threshold: parseFloat(product.min_quantity) || 0,
      is_stockable: product.track_inventory,
    };
  }

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('is_active') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const products = await this.productsService.findAll(businessId, isActiveBool);
    return products.map(p => this.transformToFrontend(p));
  }

  @Get('alerts')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findAlerts(@Param('businessId', ParseUUIDPipe) businessId: string) {
    const products = await this.productsService.findAlerts(businessId);
    return products.map(p => this.transformToFrontend(p));
  }

  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const product = await this.productsService.findOne(businessId, id);
    return this.transformToFrontend(product);
  }

  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: any,
  ) {
    const backendDto = this.transformFrontendDto(dto);
    const product = await this.productsService.create(businessId, backendDto);
    return this.transformToFrontend(product);
  }

  @Put(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    const backendDto = this.transformFrontendDto(dto);
    const product = await this.productsService.update(businessId, id, backendDto);
    return this.transformToFrontend(product);
  }

  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.remove(businessId, id);
  }
}
