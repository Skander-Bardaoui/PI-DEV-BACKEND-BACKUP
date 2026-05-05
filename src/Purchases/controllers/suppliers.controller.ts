import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard }        from '@nestjs/passport';
import { Roles } from '../../auth/decorators/roles.decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto, QuerySuppliersDto } from '../dto/update-supplier.dto';
import { SuppliersService } from '../services/suppliers.service';
import { SupplierRecommendationService } from '../services/supplier-recommendation.service';
import { Role } from '../../users/enums/role.enum';
import { PurchasePermissionGuard } from '../guards/purchase-permission.guard';
import { RequirePurchasePermission } from '../decorators/purchase-permission.decorator';
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';


@Controller('businesses/:businessId/suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard, PurchasePermissionGuard)
export class SuppliersController {

  constructor(
    private readonly service: SuppliersService,
    private readonly recommendationService: SupplierRecommendationService,
  ) {}

  // POST /businesses/:businessId/suppliers
  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('create_supplier')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.service.create(businessId, dto);
  }

  // GET /businesses/:businessId/suppliers?search=&category=&page=
@Get()
@Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
findAll(
  @Param('businessId', ParseUUIDPipe) businessId: string,
  @Query() query: QuerySuppliersDto,   // ← @Query() lit tous les ?key=value
) {
  return this.service.findAll(businessId, query);
}

  // GET /businesses/:businessId/suppliers/:id
  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(businessId, id);
  }

  // PATCH /businesses/:businessId/suppliers/:id
  @Patch(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('update_supplier')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  // DELETE /businesses/:businessId/suppliers/:id  → soft delete
  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('delete_supplier')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(businessId, id);
  }

  // PATCH /businesses/:businessId/suppliers/:id/restore
  @Patch(':id/restore')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  restore(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restore(businessId, id);
  }

  // GET /businesses/:businessId/suppliers/recommendations
  @Get('recommendations/ai')
  @UseGuards(AiFeatureGuard)
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  async getRecommendations(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('product') product?: string,
    @Query('category') category?: string,
  ) {
    const recommendations = await this.recommendationService.recommendSuppliers(
      businessId,
      product,
      category,
    );
    
    // Calculer la compétitivité des prix
    const withPriceComparison = await this.recommendationService.calculatePriceCompetitiveness(recommendations);
    
    return withPriceComparison;
  }
}

