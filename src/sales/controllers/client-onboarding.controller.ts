// src/sales/controllers/client-onboarding.controller.ts

import {
  Controller, Post, Get, Body, Param, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../auth/decorators/roles.decorators';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Role } from '../../users/enums/role.enum';
import { ClientOnboardingService } from '../services/client-onboarding.service';

export interface InviteClientDto {
  email: string;
  name?: string;
}

export interface CompleteClientOnboardingDto {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  billing_details?: string;
}

// ── Routes protégées (business owner) ────────────────────────────────────────
@Controller('businesses/:businessId/sales/client-onboarding')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ClientOnboardingController {
  constructor(private readonly svc: ClientOnboardingService) {}

  // POST /businesses/:bId/sales/client-onboarding/invite
  // Le business owner envoie une invitation par email
  @Post('invite')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  async inviteClient(@Param('businessId') businessId: string, @Body() dto: InviteClientDto) {
    return this.svc.inviteClient(businessId, dto);
  }
}

// ── Routes publiques (client) ─────────────────────────────────────────────────
// Note : on utilise 'any' pour le businessId car le client
// ne connaît pas le businessId — il est dans le JWT token
@Controller('businesses/any/sales/client-onboarding')
export class ClientOnboardingPublicController {
  constructor(private readonly svc: ClientOnboardingService) {}

  // GET /businesses/any/sales/client-onboarding/invitation/:token
  // Le client accède à sa page d'inscription via le lien
  @Get('invitation/:token')
  async getInvitationDetails(@Param('token') token: string) {
    return this.svc.getInvitationDetails(token);
  }

  // POST /businesses/any/sales/client-onboarding/invitation/:token/complete
  // Le client soumet sa fiche complétée
  @Post('invitation/:token/complete')
  async completeOnboarding(@Param('token') token: string, @Body() dto: CompleteClientOnboardingDto) {
    return this.svc.completeOnboarding(token, dto);
  }
}
