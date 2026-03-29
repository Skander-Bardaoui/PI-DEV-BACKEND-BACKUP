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
import { CreateSupplierPODto } from '../dto/create-supplier-po.dto';
import { UpdateSupplierPODto } from '../dto/update-supplier-po.dto';

@Controller('businesses/:businessId/supplier-pos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SupplierPOsController {

  constructor(
    private readonly service: SupplierPOsService,
    private readonly aiGenerator: PoAiGeneratorService,
  ) {}

  // POST /businesses/:businessId/supplier-pos/generate-from-text
  // Génération de BC par IA à partir de texte naturel
  // IMPORTANT: Cette route doit être AVANT @Post() pour éviter les conflits
  @Post('generate-from-text')
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  async generateFromText(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body('text') text: string,
  ): Promise<any> {
    return this.aiGenerator.generateFromText(businessId, text);
  }

  // POST /businesses/:businessId/supplier-pos
  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: CreateSupplierPODto,
  ) {
    return this.service.create(businessId, dto);
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
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierPODto,
  ) {
    return this.service.update(businessId, id, dto);
  }

  // POST /businesses/:businessId/supplier-pos/:id/send  → DRAFT → SENT
  @Post(':id/send')
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  send(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.send(businessId, id);
  }

  // POST /businesses/:businessId/supplier-pos/:id/confirm  → SENT → CONFIRMED
  @Post(':id/confirm')
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  confirm(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirm(businessId, id);
  }

  // POST /businesses/:businessId/supplier-pos/:id/cancel
  @Post(':id/cancel')
  @Roles(Role.BUSINESS_OWNER)
  cancel(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(businessId, id);
  }
}