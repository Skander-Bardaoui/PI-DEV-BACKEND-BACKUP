// src/Purchases/controllers/three-way-matching.controller.ts
import {
  Controller, Get, Post, Param, Query,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { AuthGuard }              from '@nestjs/passport';
import { ThreeWayMatchingService } from '../services/three-way-matching.service';

@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/three-way-matching')
export class ThreeWayMatchingController {

  constructor(private readonly svc: ThreeWayMatchingService) {}

  // GET /businesses/:bId/three-way-matching/invoice/:invoiceId
  // Rapprochement d'une facture spécifique
  @Get('invoice/:invoiceId')
  matchInvoice(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invoiceId',  ParseUUIDPipe) invoiceId:  string,
    @Query('auto') auto?: string,
    @Query('useAI') useAI?: string,
  ) {
    const enableAI = useAI !== 'false'; // Par défaut activé
    return this.svc.matchInvoice(businessId, invoiceId, auto === 'true', enableAI);
  }

  // POST /businesses/:bId/three-way-matching/invoice/:invoiceId/apply
  // Appliquer l'action automatique (approuver ou mettre en litige)
  @Post('invoice/:invoiceId/apply')
  applyMatch(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invoiceId',  ParseUUIDPipe) invoiceId:  string,
    @Query('useAI') useAI?: string,
  ) {
    const enableAI = useAI !== 'false'; // Par défaut activé
    return this.svc.matchInvoice(businessId, invoiceId, true, enableAI);
  }

  // GET /businesses/:bId/three-way-matching/pending
  // Rapprochement de toutes les factures PENDING
  @Get('pending')
  matchAllPending(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('auto') auto?: string,
    @Query('useAI') useAI?: string,
  ) {
    const enableAI = useAI !== 'false'; // Par défaut activé
    return this.svc.matchAllPending(businessId, auto === 'true', enableAI);
  }
}