// src/Purchases/controllers/supplier-portal.controller.ts
// Routes PUBLIQUES — pas de JwtAuthGuard
// Le fournisseur s'authentifie uniquement via son token de portail
//
// SUPPRIMÉ : POST /supplier-portal/invoice (upload facture par fournisseur)
// RAISON   : illogique — le fournisseur envoie sa facture papier par email,
//            le business_owner l'uploade lui-même via OCR ou saisie manuelle.
// GARDÉ    : upload-scan uniquement (pour usage interne futur si nécessaire)

import {
  Body, Controller, Get, Post, Query,
  UploadedFile, UseInterceptors, BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor }       from '@nestjs/platform-express';
import { diskStorage }           from 'multer';
import { extname, join }         from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SupplierPortalService } from '../services/supplier-portal.service';

@Controller('supplier-portal')
export class SupplierPortalController {

  constructor(private readonly svc: SupplierPortalService) {}

  // ─── GET /supplier-portal/data?token=xxx ─────────────────────────────────
  // Toutes les données du portail : fournisseur, BC courant, historique, stats
  @Get('data')
  getData(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Token manquant.');
    return this.svc.getPortalData(token);
  }

  // ─── POST /supplier-portal/confirm?token=xxx ──────────────────────────────
  // Le fournisseur confirme le BC → statut CONFIRMED
  // + email automatique envoyé au business_owner
  @Post('confirm')
  confirmPO(
    @Query('token') token: string,
    @Body('po_id')  poId:  string,
  ) {
    if (!token) throw new BadRequestException('Token manquant.');
    if (!poId)  throw new BadRequestException('po_id manquant.');
    return this.svc.confirmPO(token, poId);
  }

  // ─── POST /supplier-portal/refuse?token=xxx ───────────────────────────────
  // Le fournisseur refuse le BC avec un motif
  // + email automatique envoyé au business_owner avec le motif
  @Post('refuse')
  refusePO(
    @Query('token')  token:  string,
    @Body('po_id')   poId:   string,
    @Body('reason')  reason: string,
  ) {
    if (!token)  throw new BadRequestException('Token manquant.');
    if (!poId)   throw new BadRequestException('po_id manquant.');
    if (!reason) throw new BadRequestException('Motif de refus requis.');
    return this.svc.refusePO(token, poId, reason);
  }

  // ─── POST /supplier-portal/upload-scan?token=xxx ──────────────────────────
  // Upload du fichier scan (usage interne uniquement)
  // Le fournisseur NE CRÉE PLUS de factures via ce portail.
  // Il envoie sa facture papier au business_owner qui l'uploade lui-même.
  @Post('upload-scan')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'supplier-invoices');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        if (allowed.includes(extname(file.originalname).toLowerCase())) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Format non supporté. Acceptés : PDF, JPG, PNG.') as any,
            false,
          );
        }
      },
    }),
  )
  uploadScan(
    @Query('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!token) throw new BadRequestException('Token manquant.');
    if (!file)  throw new BadRequestException('Aucun fichier reçu.');
    return {
      url:      `/uploads/supplier-invoices/${file.filename}`,
      filename: file.originalname,
      size:     file.size,
    };
  }

  // ─── GET /supplier-portal/disputes?token=xxx ──────────────────────────────
  // Obtenir toutes les factures en litige pour ce fournisseur
  @Get('disputes')
  getDisputedInvoices(@Query('token') token: string) {
    if (!token) throw new BadRequestException('Token manquant.');
    return this.svc.getDisputedInvoices(token);
  }

  // ─── POST /supplier-portal/respond-dispute?token=xxx ──────────────────────
  // Le fournisseur répond à un litige
  @Post('respond-dispute')
  respondToDispute(
    @Query('token') token: string,
    @Body('invoice_id') invoiceId: string,
    @Body('response_message') responseMessage: string,
    @Body('proposed_solution') proposedSolution?: string,
    @Body('proposed_amount') proposedAmount?: number,
  ) {
    if (!token) throw new BadRequestException('Token manquant.');
    if (!invoiceId) throw new BadRequestException('invoice_id manquant.');
    if (!responseMessage) throw new BadRequestException('Message de réponse requis.');
    
    return this.svc.respondToDispute(
      token,
      invoiceId,
      responseMessage,
      proposedSolution,
      proposedAmount,
    );
  }
}
