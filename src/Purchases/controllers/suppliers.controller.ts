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
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard }        from '@nestjs/passport';
import { Roles } from '../../auth/decorators/roles.decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CreateSupplierDto } from '../../Purchases/dto/create-supplier.dto';
import { QuerySuppliersDto, UpdateSupplierDto } from '../../Purchases/dto/update-supplier.dto';
import { SuppliersService } from '../../Purchases/services/suppliers.service';
import { Role } from '../../users/enums/role.enum';


@Controller('businesses/:businessId/suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SuppliersController {

  constructor(private readonly service: SuppliersService) {}

  // POST /businesses/:businessId/suppliers
  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateSupplierDto,
    @Param() params: any,
    // request.user injecté via @CurrentUser — ici on utilise le décorateur maison
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
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  // DELETE /businesses/:businessId/suppliers/:id  → soft delete
  @Delete(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(businessId, id);
  }

  // PATCH /businesses/:businessId/suppliers/:id/restore
  @Patch(':id/restore')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  restore(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.restore(businessId, id);
  }
}
