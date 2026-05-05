// src/Purchases/controllers/dispute-resolution.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorators';
import { Role } from '../../users/enums/role.enum';
import { DisputeResolutionService } from '../services/dispute-resolution.service';
import type { DisputeResolutionDto } from '../services/dispute-resolution.service';

@Controller('businesses/:businessId/dispute-resolution')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DisputeResolutionController {
  constructor(private readonly service: DisputeResolutionService) {}

  // GET /businesses/:businessId/dispute-resolution/invoice/:invoiceId
  // Obtenir les informations détaillées d'un litige avec actions suggérées
  @Get('invoice/:invoiceId')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  getDisputeInfo(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.service.getDisputeInfo(businessId, invoiceId);
  }

  // POST /businesses/:businessId/dispute-resolution/invoice/:invoiceId/resolve
  // Résoudre un litige avec une action spécifique
  @Post('invoice/:invoiceId/resolve')
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  resolveDispute(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: DisputeResolutionDto,
  ) {
    return this.service.resolveDispute(businessId, invoiceId, dto);
  }

  // GET /businesses/:businessId/dispute-resolution/responses
  // Obtenir toutes les réponses des fournisseurs en attente
  @Get('responses')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN, Role.ACCOUNTANT)
  async getPendingResponses(
    @Param('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.service.getPendingResponses(businessId);
  }

  // POST /businesses/:businessId/dispute-resolution/response/:responseId/process
  // Traiter une réponse de fournisseur (accepter/rejeter)
  @Post('response/:responseId/process')
  @Roles(Role.BUSINESS_OWNER, Role.ACCOUNTANT)
  async processResponse(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
    @Body() dto: { action: 'accept' | 'reject'; admin_notes?: string },
  ) {
    return this.service.processSupplierResponse(businessId, responseId, dto);
  }
}
