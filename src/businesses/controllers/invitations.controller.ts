// src/businesses/controllers/invitations.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BusinessAccessGuard } from '../guards/business-access.guard';
import { InvitationsService } from '../services/invitations.service';
import { Role } from '../../users/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorators';
import { OwnerAndAdmin } from '../decorators/business-access.decorator';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // ─── GET /invitations/:token ─────────────────────────────────────────────
  // Public endpoint to view invitation details
  @Get(':token')
  async getInvitation(@Param('token') token: string) {
    return this.invitationsService.getInvitationByToken(token);
  }

  // ─── POST /invitations/:token/accept ─────────────────────────────────────
  // Accept an invitation and create user account
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: { firstName: string; lastName: string; phone?: string; password: string },
  ) {
    return this.invitationsService.acceptInvitationWithRegistration(
      token,
      body.firstName,
      body.lastName,
      body.password,
      body.phone,
    );
  }

  // ─── POST /invitations/:token/reject ─────────────────────────────────────
  // Reject an invitation (must be authenticated)
  @Post(':token/reject')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async rejectInvitation(@Param('token') token: string, @Request() req) {
    return this.invitationsService.rejectInvitation(token, req.user.id);
  }
}

@Controller('businesses/:businessId/invitations')
@UseGuards(AuthGuard('jwt'), RolesGuard, BusinessAccessGuard)
export class BusinessInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // ─── POST /businesses/:businessId/invitations ────────────────────────────
  // Send an invitation (Owner and Admin only)
  @Post()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async sendInvitation(
    @Param('businessId') businessId: string,
    @Body() body: { email: string; role: Role },
    @Request() req,
  ) {
    return this.invitationsService.sendInvitation(
      businessId,
      body.email,
      body.role,
      req.user.id,
    );
  }

  // ─── GET /businesses/:businessId/invitations ─────────────────────────────
  // Get all invitations for a business (Owner and Admin only)
  @Get()
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  async getBusinessInvitations(@Param('businessId') businessId: string) {
    return this.invitationsService.getBusinessInvitations(businessId);
  }

  // ─── DELETE /businesses/:businessId/invitations/:invitationId ────────────
  // Cancel an invitation (Owner and Admin only)
  @Delete(':invitationId')
  @Roles(Role.BUSINESS_OWNER, Role.BUSINESS_ADMIN)
  @OwnerAndAdmin()
  @HttpCode(HttpStatus.OK)
  async cancelInvitation(@Param('invitationId') invitationId: string) {
    await this.invitationsService.cancelInvitation(invitationId);
    return { message: 'Invitation cancelled successfully' };
  }
}
