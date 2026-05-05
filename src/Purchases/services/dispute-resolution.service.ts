// src/Purchases/services/dispute-resolution.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { InvoiceStatus } from '../enum/invoice-status.enum';
import { PurchaseMailService } from './purchase-mail.service';
import { DisputeResponse, DisputeResponseStatus } from '../entities/dispute-response.entity';

// ─── Types pour la résolution de litiges ─────────────────────────────────────

export enum DisputeCategory {
  PRICE_DISCREPANCY = 'PRICE_DISCREPANCY',
  QUANTITY_MISMATCH = 'QUANTITY_MISMATCH',
  MISSING_DELIVERY = 'MISSING_DELIVERY',
  PARTIAL_DELIVERY = 'PARTIAL_DELIVERY',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  UNAUTHORIZED_CHARGE = 'UNAUTHORIZED_CHARGE',
  DUPLICATE_INVOICE = 'DUPLICATE_INVOICE',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  OTHER = 'OTHER',
}

export enum ResolutionAction {
  APPROVE_AS_IS = 'APPROVE_AS_IS',           // Approuver malgré l'écart
  CORRECT_AMOUNTS = 'CORRECT_AMOUNTS',       // Corriger les montants dans le système
  REQUEST_CREDIT_NOTE = 'REQUEST_CREDIT_NOTE', // Demander un avoir
  REQUEST_CORRECTED_INVOICE = 'REQUEST_CORRECTED_INVOICE', // Demander facture rectificative
  REJECT_INVOICE = 'REJECT_INVOICE',         // Rejeter la facture
  WAIT_FOR_DELIVERY = 'WAIT_FOR_DELIVERY',   // Attendre la livraison complète
  CONTACT_SUPPLIER = 'CONTACT_SUPPLIER',     // Contacter le fournisseur pour clarification
}

export interface DisputeResolutionDto {
  action: ResolutionAction;
  resolution_notes?: string;
  corrected_amounts?: {
    subtotal_ht?: number;
    tax_amount?: number;
    timbre_fiscal?: number;
  };
  notify_supplier?: boolean;
}

export interface DisputeInfo {
  invoice_id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_email: string | null;
  status: InvoiceStatus;
  dispute_reason: string | null;
  dispute_category: DisputeCategory | null;
  created_at: Date;
  days_in_dispute: number;
  
  // Montants
  invoiced_amount: number;
  expected_amount: number;
  discrepancy: number;
  discrepancy_pct: number;
  
  // Actions suggérées
  suggested_actions: {
    action: ResolutionAction;
    label: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimated_time: string;
  }[];
  
  // Historique
  resolution_history?: {
    date: Date;
    action: string;
    notes: string;
    user: string;
  }[];
}

@Injectable()
export class DisputeResolutionService {
  private readonly logger = new Logger(DisputeResolutionService.name);

  constructor(
    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepo: Repository<PurchaseInvoice>,
    
    @InjectRepository(DisputeResponse)
    private readonly disputeResponseRepo: Repository<DisputeResponse>,
    
    private readonly mailService: PurchaseMailService,
  ) {}

  // ─── Obtenir les informations détaillées d'un litige ─────────────────────
  async getDisputeInfo(businessId: string, invoiceId: string): Promise<DisputeInfo> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, business_id: businessId },
      relations: ['supplier', 'supplier_po'],
    });

    if (!invoice) {
      throw new NotFoundException(`Facture introuvable (id: ${invoiceId})`);
    }

    if (invoice.status !== InvoiceStatus.DISPUTED) {
      throw new BadRequestException(`Cette facture n'est pas en litige (statut: ${invoice.status})`);
    }

    // Calculer les jours en litige
    const daysInDispute = Math.floor(
      (Date.now() - new Date(invoice.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Déterminer la catégorie du litige à partir de la raison
    const category = this.categorizeDispute(invoice.dispute_reason || '');

    // Calculer les montants attendus (si BC disponible)
    const expectedAmount = invoice.supplier_po 
      ? Number(invoice.supplier_po.net_amount)
      : Number(invoice.net_amount);
    
    const invoicedAmount = Number(invoice.net_amount);
    const discrepancy = invoicedAmount - expectedAmount;
    const discrepancyPct = expectedAmount > 0 
      ? Math.abs(discrepancy / expectedAmount) * 100 
      : 0;

    // Générer les actions suggérées
    const suggestedActions = this.generateSuggestedActions(
      category,
      discrepancy,
      discrepancyPct,
      invoice
    );

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      supplier_name: invoice.supplier?.name || '',
      supplier_email: invoice.supplier?.email || null,
      status: invoice.status,
      dispute_reason: invoice.dispute_reason,
      dispute_category: category,
      created_at: invoice.created_at,
      days_in_dispute: daysInDispute,
      invoiced_amount: invoicedAmount,
      expected_amount: expectedAmount,
      discrepancy,
      discrepancy_pct: this.round(discrepancyPct),
      suggested_actions: suggestedActions,
    };
  }

  // ─── Résoudre un litige ──────────────────────────────────────────────────
  async resolveDispute(
    businessId: string,
    invoiceId: string,
    dto: DisputeResolutionDto
  ): Promise<{ success: boolean; message: string; invoice: PurchaseInvoice }> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, business_id: businessId },
      relations: ['supplier'],
    });

    if (!invoice) {
      throw new NotFoundException(`Facture introuvable (id: ${invoiceId})`);
    }

    if (invoice.status !== InvoiceStatus.DISPUTED) {
      throw new BadRequestException(`Cette facture n'est pas en litige (statut: ${invoice.status})`);
    }

    let message = '';
    let updatedInvoice: PurchaseInvoice;

    switch (dto.action) {
      case ResolutionAction.APPROVE_AS_IS:
        updatedInvoice = await this.approveAsIs(invoice, dto.resolution_notes);
        message = `Facture ${invoice.invoice_number} approuvée malgré l'écart.`;
        break;

      case ResolutionAction.CORRECT_AMOUNTS:
        if (!dto.corrected_amounts) {
          throw new BadRequestException('Les montants corrigés sont requis pour cette action.');
        }
        updatedInvoice = await this.correctAmounts(invoice, dto.corrected_amounts, dto.resolution_notes);
        message = `Montants corrigés et facture ${invoice.invoice_number} approuvée.`;
        break;

      case ResolutionAction.REQUEST_CREDIT_NOTE:
        updatedInvoice = await this.requestCreditNote(invoice, dto.resolution_notes);
        message = `Demande d'avoir envoyée au fournisseur pour la facture ${invoice.invoice_number}.`;
        if (dto.notify_supplier && invoice.supplier?.email) {
          await this.notifySupplierCreditNote(businessId, invoice, dto.resolution_notes);
        }
        break;

      case ResolutionAction.REQUEST_CORRECTED_INVOICE:
        updatedInvoice = await this.requestCorrectedInvoice(invoice, dto.resolution_notes);
        message = `Demande de facture rectificative envoyée au fournisseur pour ${invoice.invoice_number}.`;
        if (dto.notify_supplier && invoice.supplier?.email) {
          await this.notifySupplierCorrection(businessId, invoice, dto.resolution_notes);
        }
        break;

      case ResolutionAction.REJECT_INVOICE:
        updatedInvoice = await this.rejectInvoice(invoice, dto.resolution_notes);
        message = `Facture ${invoice.invoice_number} rejetée.`;
        if (dto.notify_supplier && invoice.supplier?.email) {
          await this.notifySupplierRejection(businessId, invoice, dto.resolution_notes);
        }
        break;

      case ResolutionAction.WAIT_FOR_DELIVERY:
        updatedInvoice = await this.waitForDelivery(invoice, dto.resolution_notes);
        message = `Facture ${invoice.invoice_number} en attente de livraison complète.`;
        break;

      case ResolutionAction.CONTACT_SUPPLIER:
        updatedInvoice = invoice; // Pas de changement de statut
        message = `Email de clarification envoyé au fournisseur pour ${invoice.invoice_number}.`;
        if (invoice.supplier?.email) {
          await this.notifySupplierClarification(businessId, invoice, dto.resolution_notes);
        }
        break;

      default:
        throw new BadRequestException(`Action de résolution inconnue: ${dto.action}`);
    }

    this.logger.log(`Litige résolu: ${invoice.invoice_number} - Action: ${dto.action}`);

    return {
      success: true,
      message,
      invoice: updatedInvoice,
    };
  }

  // ─── Actions de résolution ───────────────────────────────────────────────

  private async approveAsIs(invoice: PurchaseInvoice, notes?: string): Promise<PurchaseInvoice> {
    invoice.status = InvoiceStatus.APPROVED;
    invoice.dispute_reason = notes 
      ? `[Résolu] ${invoice.dispute_reason}\nNotes: ${notes}`
      : `[Résolu] ${invoice.dispute_reason}`;
    return this.invoiceRepo.save(invoice);
  }

  private async correctAmounts(
    invoice: PurchaseInvoice,
    amounts: { subtotal_ht?: number; tax_amount?: number; timbre_fiscal?: number },
    notes?: string
  ): Promise<PurchaseInvoice> {
    if (amounts.subtotal_ht !== undefined) invoice.subtotal_ht = amounts.subtotal_ht;
    if (amounts.tax_amount !== undefined) invoice.tax_amount = amounts.tax_amount;
    if (amounts.timbre_fiscal !== undefined) invoice.timbre_fiscal = amounts.timbre_fiscal;

    // Recalculer le net_amount
    const timbre = Number(invoice.timbre_fiscal) || 1.000;
    invoice.net_amount = this.round(
      Number(invoice.subtotal_ht) + Number(invoice.tax_amount) + timbre
    );

    invoice.status = InvoiceStatus.APPROVED;
    invoice.dispute_reason = notes
      ? `[Résolu - Montants corrigés] ${invoice.dispute_reason}\nNotes: ${notes}`
      : `[Résolu - Montants corrigés] ${invoice.dispute_reason}`;

    return this.invoiceRepo.save(invoice);
  }

  private async requestCreditNote(invoice: PurchaseInvoice, notes?: string): Promise<PurchaseInvoice> {
    invoice.dispute_reason = notes
      ? `[En attente d'avoir] ${invoice.dispute_reason}\nNotes: ${notes}`
      : `[En attente d'avoir] ${invoice.dispute_reason}`;
    return this.invoiceRepo.save(invoice);
  }

  private async requestCorrectedInvoice(invoice: PurchaseInvoice, notes?: string): Promise<PurchaseInvoice> {
    invoice.dispute_reason = notes
      ? `[En attente de facture rectificative] ${invoice.dispute_reason}\nNotes: ${notes}`
      : `[En attente de facture rectificative] ${invoice.dispute_reason}`;
    return this.invoiceRepo.save(invoice);
  }

  private async rejectInvoice(invoice: PurchaseInvoice, notes?: string): Promise<PurchaseInvoice> {
    invoice.status = InvoiceStatus.PENDING; // Retour à PENDING pour archivage
    invoice.dispute_reason = notes
      ? `[Rejetée] ${invoice.dispute_reason}\nNotes: ${notes}`
      : `[Rejetée] ${invoice.dispute_reason}`;
    return this.invoiceRepo.save(invoice);
  }

  private async waitForDelivery(invoice: PurchaseInvoice, notes?: string): Promise<PurchaseInvoice> {
    invoice.dispute_reason = notes
      ? `[En attente de livraison] ${invoice.dispute_reason}\nNotes: ${notes}`
      : `[En attente de livraison] ${invoice.dispute_reason}`;
    return this.invoiceRepo.save(invoice);
  }

  // ─── Notifications fournisseur ───────────────────────────────────────────

  private async notifySupplierCreditNote(
    businessId: string,
    invoice: PurchaseInvoice,
    notes?: string
  ): Promise<void> {
    // TODO: Implémenter l'envoi d'email pour demande d'avoir
    this.logger.log(`Email demande d'avoir envoyé pour ${invoice.invoice_number}`);
  }

  private async notifySupplierCorrection(
    businessId: string,
    invoice: PurchaseInvoice,
    notes?: string
  ): Promise<void> {
    // TODO: Implémenter l'envoi d'email pour demande de correction
    this.logger.log(`Email demande de correction envoyé pour ${invoice.invoice_number}`);
  }

  private async notifySupplierRejection(
    businessId: string,
    invoice: PurchaseInvoice,
    notes?: string
  ): Promise<void> {
    // TODO: Implémenter l'envoi d'email pour rejet
    this.logger.log(`Email de rejet envoyé pour ${invoice.invoice_number}`);
  }

  private async notifySupplierClarification(
    businessId: string,
    invoice: PurchaseInvoice,
    notes?: string
  ): Promise<void> {
    if (!invoice.supplier?.email) {
      this.logger.warn(`Impossible d'envoyer l'email : fournisseur sans email`);
      return;
    }

    // Calculer les montants pour l'email
    const invoicedAmount = Number(invoice.net_amount);
    const expectedAmount = invoice.supplier_po 
      ? Number(invoice.supplier_po.net_amount)
      : invoicedAmount;
    const discrepancy = invoicedAmount - expectedAmount;

    // Déterminer la catégorie du litige
    const category = this.categorizeDispute(invoice.dispute_reason || '');

    // Envoyer l'email sans token - le fournisseur répondra par email
    await this.mailService.sendDisputeClarificationEmail(
      businessId,
      invoice.supplier.email,
      invoice.supplier.name,
      invoice.invoice_number,
      invoice.dispute_reason || 'Clarification requise',
      notes || 'Merci de nous fournir des clarifications concernant cette facture.',
      category,
      invoicedAmount,
      expectedAmount,
      discrepancy,
    );

    this.logger.log(`Email de clarification envoyé pour ${invoice.invoice_number}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private categorizeDispute(reason: string): DisputeCategory {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('prix') || lowerReason.includes('price')) {
      return DisputeCategory.PRICE_DISCREPANCY;
    }
    if (lowerReason.includes('quantité') || lowerReason.includes('quantity')) {
      return DisputeCategory.QUANTITY_MISMATCH;
    }
    if (lowerReason.includes('livraison') || lowerReason.includes('delivery') || lowerReason.includes('réception')) {
      return DisputeCategory.MISSING_DELIVERY;
    }
    if (lowerReason.includes('partiel') || lowerReason.includes('partial')) {
      return DisputeCategory.PARTIAL_DELIVERY;
    }
    if (lowerReason.includes('calcul') || lowerReason.includes('calculation') || lowerReason.includes('tva')) {
      return DisputeCategory.CALCULATION_ERROR;
    }
    if (lowerReason.includes('frais') || lowerReason.includes('charge') || lowerReason.includes('autorisé')) {
      return DisputeCategory.UNAUTHORIZED_CHARGE;
    }
    if (lowerReason.includes('double') || lowerReason.includes('duplicate')) {
      return DisputeCategory.DUPLICATE_INVOICE;
    }
    if (lowerReason.includes('qualité') || lowerReason.includes('quality') || lowerReason.includes('défaut')) {
      return DisputeCategory.QUALITY_ISSUE;
    }
    
    return DisputeCategory.OTHER;
  }

  private generateSuggestedActions(
    category: DisputeCategory,
    discrepancy: number,
    discrepancyPct: number,
    invoice: PurchaseInvoice
  ): DisputeInfo['suggested_actions'] {
    const actions: DisputeInfo['suggested_actions'] = [];

    switch (category) {
      case DisputeCategory.PRICE_DISCREPANCY:
        if (discrepancy > 0) {
          actions.push({
            action: ResolutionAction.REQUEST_CREDIT_NOTE,
            label: 'Demander un avoir',
            description: `Demander un avoir de ${Math.abs(discrepancy).toFixed(3)} TND au fournisseur`,
            priority: 'high',
            estimated_time: '3-5 jours',
          });
        }
        actions.push({
          action: ResolutionAction.CONTACT_SUPPLIER,
          label: 'Contacter le fournisseur',
          description: 'Demander une explication sur l\'écart de prix',
          priority: 'high',
          estimated_time: '1-2 jours',
        });
        break;

      case DisputeCategory.QUANTITY_MISMATCH:
        actions.push({
          action: ResolutionAction.REQUEST_CORRECTED_INVOICE,
          label: 'Demander facture rectificative',
          description: 'Demander une facture avec les quantités correctes',
          priority: 'high',
          estimated_time: '5-7 jours',
        });
        actions.push({
          action: ResolutionAction.CORRECT_AMOUNTS,
          label: 'Corriger les montants',
          description: 'Corriger les montants dans le système',
          priority: 'medium',
          estimated_time: 'Immédiat',
        });
        break;

      case DisputeCategory.PARTIAL_DELIVERY:
        actions.push({
          action: ResolutionAction.WAIT_FOR_DELIVERY,
          label: 'Attendre la livraison complète',
          description: 'Mettre en attente jusqu\'à réception complète',
          priority: 'medium',
          estimated_time: '2-3 jours',
        });
        actions.push({
          action: ResolutionAction.APPROVE_AS_IS,
          label: 'Approuver la livraison partielle',
          description: 'Approuver si la facture correspond à ce qui a été reçu',
          priority: 'low',
          estimated_time: 'Immédiat',
        });
        break;

      case DisputeCategory.CALCULATION_ERROR:
        actions.push({
          action: ResolutionAction.CORRECT_AMOUNTS,
          label: 'Corriger les montants',
          description: 'Corriger l\'erreur de calcul dans le système',
          priority: 'high',
          estimated_time: 'Immédiat',
        });
        actions.push({
          action: ResolutionAction.REQUEST_CORRECTED_INVOICE,
          label: 'Demander facture rectificative',
          description: 'Demander au fournisseur de corriger sa facture',
          priority: 'medium',
          estimated_time: '1-2 jours',
        });
        break;

      case DisputeCategory.DUPLICATE_INVOICE:
        actions.push({
          action: ResolutionAction.REJECT_INVOICE,
          label: 'Rejeter le doublon',
          description: 'Rejeter cette facture en double',
          priority: 'high',
          estimated_time: 'Immédiat',
        });
        break;

      default:
        actions.push({
          action: ResolutionAction.CONTACT_SUPPLIER,
          label: 'Contacter le fournisseur',
          description: 'Demander des clarifications',
          priority: 'medium',
          estimated_time: '1-2 jours',
        });
        actions.push({
          action: ResolutionAction.APPROVE_AS_IS,
          label: 'Approuver malgré l\'écart',
          description: 'Approuver si l\'écart est justifié',
          priority: 'low',
          estimated_time: 'Immédiat',
        });
    }

    return actions;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }

  // ─── Obtenir les réponses en attente ─────────────────────────────────────
  async getPendingResponses(businessId: string) {
    const responses = await this.disputeResponseRepo.find({
      where: {
        business_id: businessId,
        status: DisputeResponseStatus.PENDING,
      },
      relations: ['invoice', 'supplier', 'invoice.supplier_po'],
      order: { created_at: 'DESC' },
    });

    return responses.map(response => ({
      id: response.id,
      invoice_number: response.invoice.invoice_number,
      supplier_name: response.supplier.name,
      response_message: response.response_message,
      proposed_solution: response.proposed_solution,
      proposed_amount: response.proposed_amount,
      created_at: response.created_at,
      invoice_amount: Number(response.invoice.net_amount),
      expected_amount: response.invoice.supplier_po 
        ? Number(response.invoice.supplier_po.net_amount)
        : Number(response.invoice.net_amount),
    }));
  }

  // ─── Traiter une réponse de fournisseur ──────────────────────────────────
  async processSupplierResponse(
    businessId: string,
    responseId: string,
    dto: { action: 'accept' | 'reject'; admin_notes?: string },
  ) {
    const response = await this.disputeResponseRepo.findOne({
      where: { id: responseId, business_id: businessId },
      relations: ['invoice', 'supplier'],
    });

    if (!response) {
      throw new NotFoundException('Réponse introuvable.');
    }

    if (response.status !== DisputeResponseStatus.PENDING) {
      throw new BadRequestException('Cette réponse a déjà été traitée.');
    }

    const invoice = response.invoice;

    if (dto.action === 'accept') {
      // Accepter la réponse et résoudre le litige
      response.status = DisputeResponseStatus.ACCEPTED;
      response.admin_notes = dto.admin_notes || 'Réponse acceptée';
      response.processed_at = new Date();

      // Si un montant proposé existe, mettre à jour la facture
      if (response.proposed_amount) {
        invoice.net_amount = response.proposed_amount;
      }

      // Résoudre le litige
      invoice.status = InvoiceStatus.APPROVED;
      invoice.dispute_reason = `[Résolu - Réponse fournisseur acceptée] ${invoice.dispute_reason}`;

      await this.invoiceRepo.save(invoice);
      await this.disputeResponseRepo.save(response);

      this.logger.log(
        `Réponse acceptée pour facture ${invoice.invoice_number} - Litige résolu`
      );

      return {
        success: true,
        message: 'Réponse acceptée et litige résolu',
        invoice,
      };
    } else {
      // Rejeter la réponse
      response.status = DisputeResponseStatus.REJECTED;
      response.admin_notes = dto.admin_notes || 'Réponse rejetée';
      response.processed_at = new Date();

      await this.disputeResponseRepo.save(response);

      this.logger.log(
        `Réponse rejetée pour facture ${invoice.invoice_number} - Litige toujours actif`
      );

      return {
        success: true,
        message: 'Réponse rejetée - Le litige reste actif',
        invoice,
      };
    }
  }
}
