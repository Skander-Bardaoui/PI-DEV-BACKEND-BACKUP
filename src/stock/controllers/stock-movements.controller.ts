// src/stock/controllers/stock-movements.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StockMovementsService } from '../services/stock-movements/stock-movements.service';
import { CreateStockMovementDto } from '../dto/create-stock-movement.dto';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { StockMovementType } from '../enums/stock-movement-type.enum';

@Controller('businesses/:businessId/stock-movements')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StockMovementsController {
  constructor(private readonly movementsService: StockMovementsService) {}

  private transformMovement(movement: any) {
    return {
      ...movement,
      quantity: parseFloat(movement.quantity) || 0,
      stock_before: parseFloat(movement.quantity_before) || 0,
      stock_after: parseFloat(movement.quantity_after) || 0,
      quantity_before: parseFloat(movement.quantity_before) || 0,
      quantity_after: parseFloat(movement.quantity_after) || 0,
      unit_cost: movement.unit_cost ? parseFloat(movement.unit_cost) : null,
      total_value: movement.total_value ? parseFloat(movement.total_value) : null,
    };
  }

  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('product_id') productId?: string,
    @Query('type') type?: StockMovementType,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.movementsService.findAll(
      businessId,
      productId,
      type,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
    return {
      data: result.data.map(m => this.transformMovement(m)),
      total: result.total,
    };
  }

  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const movement = await this.movementsService.findOne(businessId, id);
    return this.transformMovement(movement);
  }

  @Post('manual')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async createManual(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    const movement = await this.movementsService.createManual(businessId, dto);
    return this.transformMovement(movement);
  }

  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  remove(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.movementsService.remove(businessId, id);
  }
}
