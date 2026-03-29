// src/Purchases/controllers/supplier-onboarding.controller.ts
import {
  Controller, Post, Get, Body, Param, Query,
  UseGuards, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import { AuthGuard }                 from '@nestjs/passport';
import { Roles }                     from '../../auth/decorators/roles.decorators';
import { RolesGuard }                from '../../auth/guards/roles.guard';
import { Role }                      from '../../users/enums/role.enum';
import { SupplierOnboardingService } from '../services/supplier-onboarding.service';

// ── Routes protégées (business owner) ────────────────────────────────────────
@Controller('businesses/:businessId/supplier-onboarding')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SupplierOnboardingController {
  constructor(private readonly svc: SupplierOnboardingService) {}

  // POST /businesses/:bId/supplier-onboarding/invite
  // Le business owner envoie une invitation par email
  @Post('invite')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  invite(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: { email: string; name?: string },
  ) {
    if (!dto.email) throw new BadRequestException('Email requis.');
    return this.svc.sendInvitation(businessId, dto.email, dto.name);
  }
}

// ── Routes publiques (fournisseur non authentifié) ─────────────────────────
// Note : on utilise 'any' pour le businessId car le fournisseur
// ne connaît pas le businessId — il est dans le JWT token
@Controller('businesses/any/supplier-onboarding')
export class SupplierOnboardingPublicController {
  constructor(private readonly svc: SupplierOnboardingService) {}

  // GET /businesses/any/supplier-onboarding/invitation/:token
  // Le fournisseur accède à sa page d'inscription via le lien
  @Get('invitation/:token')
  getInvitation(@Param('token') token: string) {
    return this.svc.getInvitationData(token);
  }

  // POST /businesses/any/supplier-onboarding/invitation/:token/complete
  // Le fournisseur soumet sa fiche complétée
  @Post('invitation/:token/complete')
  completeInvitation(
    @Param('token') token: string,
    @Body() dto: {
      name:              string;
      phone?:            string;
      matricule_fiscal?: string;
      rib?:              string;
      bank_name?:        string;
      category?:         string;
      payment_terms?:    number;
      notes?:            string;
      address?: {
        street?:      string;
        city?:        string;
        postal_code?: string;
        country?:     string;
      };
    },
  ) {
    return this.svc.completeInvitation(token, dto);
  }
}