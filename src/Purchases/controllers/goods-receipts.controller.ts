import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard }              from '@nestjs/passport';
import { GoodsReceiptsService }   from '../services/goods-receipts.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles }      from '../../auth/decorators/roles.decorators';
import { Role }       from '../../users/enums/role.enum';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { PurchasePermissionGuard } from '../guards/purchase-permission.guard';
import { RequirePurchasePermission } from '../decorators/purchase-permission.decorator';

@Controller('businesses/:businessId')
@UseGuards(AuthGuard('jwt'), RolesGuard, PurchasePermissionGuard)
export class GoodsReceiptsController {

  constructor(private readonly service: GoodsReceiptsService) {}

  // POST /businesses/:businessId/supplier-pos/:poId/goods-receipt
  @Post('supplier-pos/:poId/goods-receipt')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('create_goods_receipt')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('poId', ParseUUIDPipe) poId: string,
    @Body() dto: CreateGoodsReceiptDto,
    @Request() req: any,
  ) {
    return this.service.create(businessId, poId, dto, req.user.id);
  }

  // GET /businesses/:businessId/supplier-pos/:poId/goods-receipts
  @Get('supplier-pos/:poId/goods-receipts')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findAllByPO(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('poId', ParseUUIDPipe) poId: string,
  ) {
    return this.service.findAllByPO(businessId, poId);
  }

  // GET /businesses/:businessId/goods-receipts/:id
  @Get('goods-receipts/:id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(businessId, id);
  }
}