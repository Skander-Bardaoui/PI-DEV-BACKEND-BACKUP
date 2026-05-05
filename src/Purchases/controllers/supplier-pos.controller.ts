import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard }         from '@nestjs/passport';
import { SupplierPOsService } from '../services/supplier-pos.service';
import { PoAiGeneratorService } from '../services/po-ai-generator.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles }      from '../../auth/decorators/roles.decorators';
import { Role }       from '../../users/enums/role.enum';
import { CreateSupplierPODto, UpdateSupplierPODto } from '../schemas/purchases.schemas';
import { PurchasePermissionGuard } from '../guards/purchase-permission.guard';
import { RequirePurchasePermission } from '../decorators/purchase-permission.decorator';
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

@Controller('businesses/:businessId/supplier-pos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PurchasePermissionGuard)
export class SupplierPOsController {

  constructor(
    private readonly service: SupplierPOsService,
    private readonly aiGenerator: PoAiGeneratorService,
  ) {}

  // POST /businesses/:businessId/supplier-pos/generate-from-text
  // Génération de BC par IA à partir de texte naturel
  // IMPORTANT: Cette route doit être AVANT @Post() pour éviter les conflits
  @Post('generate-from-text')
  @UseGuards(AiFeatureGuard)
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  async generateFromText(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: Record<string, any>,
  ): Promise<any> {
    // Lire le texte directement depuis le body brut pour éviter les transformations Zod
    const text = body?.text ?? body?.['text'];
    
    console.log('🔍 [Controller] generateFromText appelé');
    console.log('🔍 [Controller] businessId:', businessId);
    console.log('🔍 [Controller] body reçu:', JSON.stringify(body));
    console.log('🔍 [Controller] text extrait:', text);
    console.log('🔍 [Controller] type de text:', typeof text);
    
    return this.aiGenerator.generateFromText(businessId, text);
  }

  // POST /businesses/:businessId/supplier-pos
  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('create_purchase_order')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: any, // Temporairement any pour voir ce qui arrive
  ) {
    console.log('🔍 Controller received DTO:', JSON.stringify(dto, null, 2));
    console.log('🔍 DTO type:', typeof dto);
    console.log('🔍 DTO keys:', Object.keys(dto));
    console.log('🔍 Items in DTO:', dto.items ? `${dto.items.length} items` : 'UNDEFINED');
    
    if (!dto.items || !Array.isArray(dto.items)) {
      throw new Error(`Items is missing or not an array. Received: ${JSON.stringify(dto)}`);
    }
    
    return this.service.create(businessId, dto as CreateSupplierPODto);
  }

  // GET /businesses/:businessId/supplier-pos?status=&supplier_id=&page=
  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findAll(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: any,
  ) {
    return this.service.findAll(businessId, query);
  }

  // GET /businesses/:businessId/supplier-pos/:id
  @Get(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  findOne(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(businessId, id);
  }

  // PATCH /businesses/:businessId/supplier-pos/:id
  @Patch(':id')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('update_purchase_order')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,  // Use 'any' to bypass ValidationPipe whitelist
  ) {
    console.log('🎯 CONTROLLER: Update called for PO id =', id);
    console.log('🎯 CONTROLLER: businessId =', businessId);
    console.log('🎯 CONTROLLER: DTO =', JSON.stringify(dto, null, 2));
    console.log('🎯 CONTROLLER: Calling service.update()...');
    const result = this.service.update(businessId, id, dto);
    console.log('🎯 CONTROLLER: service.update() returned');
    return result;
  }

  // POST /businesses/:businessId/supplier-pos/:id/send  → DRAFT → SENT
  @Post(':id/send')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('send_purchase_order')
  send(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.send(businessId, id);
  }

  // POST /businesses/:businessId/supplier-pos/:id/confirm  → SENT → CONFIRMED
  @Post(':id/confirm')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('confirm_purchase_order')
  confirm(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirm(businessId, id);
  }

  // POST /businesses/:businessId/supplier-pos/:id/cancel
  @Post(':id/cancel')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT, Role.TEAM_MEMBER)
  @RequirePurchasePermission('confirm_purchase_order')
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(businessId, id);
  }
}