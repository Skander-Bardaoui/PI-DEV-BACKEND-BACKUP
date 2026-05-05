// src/Purchases/controllers/three-way-matching.controller.ts
import {
  Controller, Get, Post, Param, Query,
  ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { AuthGuard }              from '@nestjs/passport';
import { ThreeWayMatchingService } from '../services/three-way-matching.service';
import { PurchaseMailService } from '../services/purchase-mail.service';
import { AiFeatureGuard } from '../../platform-admin/guards/ai-feature.guard';

@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/three-way-matching')
export class ThreeWayMatchingController {

  constructor(
    private readonly svc: ThreeWayMatchingService,
    private readonly mailService: PurchaseMailService,
  ) {}

  // GET /businesses/:bId/three-way-matching/invoice/:invoiceId
  // Rapprochement d'une facture spécifique
  @Get('invoice/:invoiceId')
  @UseGuards(AiFeatureGuard)
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
  @UseGuards(AiFeatureGuard)
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
  @UseGuards(AiFeatureGuard)
  matchAllPending(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query('auto') auto?: string,
    @Query('useAI') useAI?: string,
  ) {
    const enableAI = useAI !== 'false'; // Par défaut activé
    return this.svc.matchAllPending(businessId, auto === 'true', enableAI);
  }

  // POST /businesses/:bId/three-way-matching/invoice/:invoiceId/contact-supplier
  // Envoyer un email au fournisseur concernant les écarts
  @Post('invoice/:invoiceId/contact-supplier')
  @UseGuards(AiFeatureGuard)
  async contactSupplier(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('invoiceId',  ParseUUIDPipe) invoiceId:  string,
    @Query('useAI') useAI?: string,
  ) {
    try {
      const enableAI = useAI !== 'false';
      
      // Récupérer les détails du rapprochement
      const matchResult = await this.svc.matchInvoice(businessId, invoiceId, false, enableAI);
      
      if (!matchResult.supplier_email) {
        return {
          success: false,
          message: `Le fournisseur "${matchResult.supplier_name}" n'a pas d'email configuré.`,
        };
      }

      // Envoyer l'email
      await this.mailService.sendInvoiceDiscrepancyEmail(
        businessId,
        matchResult.supplier_email,
        matchResult.supplier_name,
        matchResult.invoice_number,
        matchResult.invoiced_total,
        matchResult.received_total,
        matchResult.total_discrepancy,
        matchResult.discrepancy_pct,
        matchResult.issues || [],
      );

      return {
        success: true,
        message: `Email envoyé à ${matchResult.supplier_name} (${matchResult.supplier_email})`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Erreur lors de l'envoi de l'email : ${error.message}`,
      };
    }
  }
}