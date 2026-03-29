// src/Purchases/services/three-way-matching.service.ts
//
// Rapprochement 3 voies : BC (Bon de Commande) ↔ BR (Bon de Réception) ↔ Facture
//
// Logique comptable tunisienne :
// 1. Vérifier que la facture correspond à un BC existant
// 2. Vérifier que les marchandises ont bien été réceptionnées (BR)
// 3. Vérifier que les montants facturés correspondent aux montants commandés
// 4. Si tout correspond → approbation automatique
// 5. Si écart détecté → litige automatique avec rapport détaillé

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { PurchaseInvoice }  from '../entities/purchase-invoice.entity';
import { SupplierPO }       from '../entities/supplier-po.entity';
import { SupplierPOItem }   from '../entities/supplier-po-item.entity';
import { GoodsReceipt }     from '../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../entities/goods-receipt-item.entity';
import { InvoiceStatus }    from '../enum/invoice-status.enum';
import { POStatus }         from '../enum/po-status.enum';
import { ThreeWayMatchingAIService, AIMatchingAnalysis } from './three-way-matching-ai.service';

// ─── Types résultat ──────────────────────────────────────────────────────────

export enum MatchStatus {
  MATCHED        = 'MATCHED',        // Tout correspond — approbation auto
  PARTIAL_MATCH  = 'PARTIAL_MATCH',  // Écarts mineurs (tolérance 0.5%)
  MISMATCH       = 'MISMATCH',       // Écarts significatifs — litige auto
  MISSING_PO     = 'MISSING_PO',     // Pas de BC associé
  MISSING_GR     = 'MISSING_GR',     // Pas de bon de réception
  OVER_INVOICED  = 'OVER_INVOICED',  // Facturé plus que commandé
  UNDER_INVOICED = 'UNDER_INVOICED', // Facturé moins que commandé
}

export interface LineDiscrepancy {
  description:        string;
  po_quantity:        number;
  received_quantity:  number;
  invoiced_quantity:  number;
  po_unit_price:      number;
  po_line_total:      number;
  received_total:     number;
  discrepancy_amount: number;
  discrepancy_pct:    number;
  status:             'OK' | 'PRICE_MISMATCH' | 'QTY_MISMATCH' | 'NOT_RECEIVED' | 'OVER_INVOICED';
}

export interface ThreeWayMatchResult {
  invoice_id:           string;
  invoice_number:       string;
  supplier_name:        string;
  status:               MatchStatus;
  can_auto_approve:     boolean;
  should_auto_dispute:  boolean;

  // Comparaison des totaux
  po_total:             number;
  received_total:       number;
  invoiced_total:       number;
  total_discrepancy:    number;
  discrepancy_pct:      number;

  // Détail par ligne
  line_discrepancies:   LineDiscrepancy[];

  // Résumé
  issues:               string[];
  recommendations:      string[];

  // Données sources
  po_number:            string | null;
  gr_numbers:           string[];
  matching_date:        Date;

  // Analyse IA (optionnelle)
  ai_analysis?:         AIMatchingAnalysis;
}

const TOLERANCE_PCT = 0.5; // 0.5% de tolérance acceptable

@Injectable()
export class ThreeWayMatchingService {

  private readonly logger = new Logger(ThreeWayMatchingService.name);

  constructor(
    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepo: Repository<PurchaseInvoice>,

    @InjectRepository(SupplierPO)
    private readonly poRepo: Repository<SupplierPO>,

    @InjectRepository(SupplierPOItem)
    private readonly poItemRepo: Repository<SupplierPOItem>,

    @InjectRepository(GoodsReceipt)
    private readonly grRepo: Repository<GoodsReceipt>,

    @InjectRepository(GoodsReceiptItem)
    private readonly grItemRepo: Repository<GoodsReceiptItem>,

    private readonly aiService: ThreeWayMatchingAIService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Effectuer le rapprochement sur une facture
  // ─────────────────────────────────────────────────────────────────────────
  async matchInvoice(
    businessId: string,
    invoiceId:  string,
    autoAction: boolean = false, // si true → approuve ou met en litige automatiquement
    useAI:      boolean = true,  // si true → utilise l'analyse IA
  ): Promise<ThreeWayMatchResult> {

    // 1. Charger la facture
    const invoice = await this.invoiceRepo.findOne({
      where:     { id: invoiceId, business_id: businessId },
      relations: ['supplier'],
    });
    if (!invoice) throw new NotFoundException(`Facture introuvable (id: ${invoiceId})`);

    const issues:          string[] = [];
    const recommendations: string[] = [];
    const lineDiscrepancies: LineDiscrepancy[] = [];

    // 2. Vérifier si un BC est associé
    if (!invoice.supplier_po_id) {
      const result = this.buildResult(invoice, null, [], {
        status:              MatchStatus.MISSING_PO,
        can_auto_approve:    false,
        should_auto_dispute: false,
        po_total:            0,
        received_total:      0,
        invoiced_total:      Number(invoice.net_amount),
        total_discrepancy:   Number(invoice.net_amount),
        discrepancy_pct:     100,
        line_discrepancies:  [],
        issues:              ['Aucun bon de commande associé à cette facture.'],
        recommendations:     ['Associez cette facture à un BC existant pour effectuer le rapprochement.'],
        gr_numbers:          [],
      });

      if (autoAction) await this.applyAutoAction(result, businessId, invoiceId);
      return result;
    }

    // 3. Charger le BC et ses lignes
    const po = await this.poRepo.findOne({
      where:     { id: invoice.supplier_po_id, business_id: businessId },
      relations: ['items', 'supplier'],
    });
    if (!po) {
      issues.push('BC associé introuvable en base de données.');
      return this.buildResult(invoice, null, [], {
        status: MatchStatus.MISSING_PO, can_auto_approve: false,
        should_auto_dispute: true, po_total: 0,
        received_total: 0, invoiced_total: Number(invoice.net_amount),
        total_discrepancy: Number(invoice.net_amount), discrepancy_pct: 100,
        line_discrepancies: [], issues, recommendations: [], gr_numbers: [],
      });
    }

    // 4. Charger les bons de réception
    const goodsReceipts = await this.grRepo.find({
      where:     { supplier_po_id: po.id, business_id: businessId },
      relations: ['items'],
    });

    const grNumbers = goodsReceipts.map(gr => gr.gr_number);

    if (goodsReceipts.length === 0) {
      issues.push('Aucun bon de réception trouvé pour ce BC.');
      recommendations.push('Créez un bon de réception avant d\'approuver cette facture.');
    }

    // 5. Calculer les quantités reçues par ligne BC
    const receivedByPOItem = new Map<string, number>();
    for (const gr of goodsReceipts) {
      for (const grItem of (gr.items ?? [])) {
        const current = receivedByPOItem.get(grItem.supplier_po_item_id) ?? 0;
        receivedByPOItem.set(
          grItem.supplier_po_item_id,
          current + Number(grItem.quantity_received),
        );
      }
    }

    // 6. Comparer ligne par ligne
    let poTotal       = 0;
    let receivedTotal = 0;

    for (const poItem of (po.items ?? [])) {
      const qtyOrdered  = Number(poItem.quantity_ordered);
      const qtyReceived = receivedByPOItem.get(poItem.id) ?? 0;
      const unitPrice   = Number(poItem.unit_price_ht);
      const taxRate     = Number(poItem.tax_rate_value) / 100;

      const poLineTotal       = this.round(qtyOrdered  * unitPrice * (1 + taxRate));
      const receivedLineTotal = this.round(qtyReceived * unitPrice * (1 + taxRate));

      poTotal       += poLineTotal;
      receivedTotal += receivedLineTotal;

      // Comparer avec ce qui est facturé (approximation sur la facture globale)
      const discrepancyAmt = this.round(receivedLineTotal - poLineTotal);
      const discrepancyPct = poLineTotal > 0
        ? Math.abs(discrepancyAmt / poLineTotal) * 100
        : 0;

      let lineStatus: LineDiscrepancy['status'] = 'OK';

      if (qtyReceived === 0) {
        lineStatus = 'NOT_RECEIVED';
        issues.push(`"${poItem.description}" : commandé mais pas encore réceptionné.`);
      } else if (qtyReceived > qtyOrdered) {
        lineStatus = 'OVER_INVOICED';
        issues.push(`"${poItem.description}" : reçu plus que commandé (${qtyReceived} > ${qtyOrdered}).`);
      } else if (qtyReceived < qtyOrdered && Math.abs(discrepancyAmt) > 0.005) {
        // Réception partielle : c'est OK si la facture correspond à ce qui a été reçu
        // On ne signale PAS d'erreur ici, c'est normal
        lineStatus = 'OK';
      } else if (discrepancyPct > TOLERANCE_PCT) {
        lineStatus = 'QTY_MISMATCH';
        issues.push(`"${poItem.description}" : écart de quantité (commandé ${qtyOrdered}, reçu ${qtyReceived}).`);
      }

      lineDiscrepancies.push({
        description:        poItem.description,
        po_quantity:        qtyOrdered,
        received_quantity:  qtyReceived,
        invoiced_quantity:  qtyOrdered, // simplification — on compare BC vs BR
        po_unit_price:      unitPrice,
        po_line_total:      poLineTotal,
        received_total:     receivedLineTotal,
        discrepancy_amount: discrepancyAmt,
        discrepancy_pct:    this.round(discrepancyPct),
        status:             lineStatus,
      });
    }

    poTotal       = this.round(poTotal);
    receivedTotal = this.round(receivedTotal);
    
    // FIX CRITIQUE : Ajouter le timbre fiscal au montant réceptionné
    // Le timbre est un montant fixe qui doit être payé sur toute facture
    const timbreFiscal = 1.000; // Timbre fiscal tunisien standard
    receivedTotal = this.round(receivedTotal + timbreFiscal);
    
    const invoicedTotal   = Number(invoice.net_amount);
    const totalDiscrep    = this.round(invoicedTotal - receivedTotal);
    const discrepancyPct  = receivedTotal > 0
      ? this.round(Math.abs(totalDiscrep / receivedTotal) * 100)
      : 100;

    // 7. Comparaison montant facturé vs montant reçu
    // LOGIQUE CORRIGÉE : Comparer la facture avec ce qui a été REÇU (incluant timbre fiscal)
    // La facture doit correspondre exactement à ce qui a été réceptionné + timbre
    if (Math.abs(totalDiscrep) > 0.005) {
      if (invoicedTotal > receivedTotal) {
        issues.push(`Surfacturation détectée : ${invoicedTotal.toFixed(3)} TND facturé vs ${receivedTotal.toFixed(3)} TND reçu (incluant timbre). Écart : +${Math.abs(totalDiscrep).toFixed(3)} TND.`);
      } else {
        // Facture inférieure à la réception : peut être normal (remise, avoir...)
        recommendations.push(`Sous-facturation : ${invoicedTotal.toFixed(3)} TND facturé vs ${receivedTotal.toFixed(3)} TND reçu. Vérifier si remise ou avoir appliqué.`);
      }
    } else {
      recommendations.push('Montants parfaitement alignés : facture = réception + timbre fiscal.');
    }

    // 8. Déterminer le statut global
    // LOGIQUE CORRIGÉE : 
    // - Réception partielle = OK si facture correspond exactement à ce qui est reçu
    // - Surfacturation = LITIGE automatique
    // - Sous-facturation = OK (remise ou avoir)
    const hasNotReceived  = lineDiscrepancies.some(l => l.status === 'NOT_RECEIVED');
    const hasOverInvoiced = lineDiscrepancies.some(l => l.status === 'OVER_INVOICED');
    const hasQtyMismatch  = lineDiscrepancies.some(l => l.status === 'QTY_MISMATCH');
    const allOk           = lineDiscrepancies.every(l => l.status === 'OK');
    const noGR            = goodsReceipts.length === 0;

    let status: MatchStatus;
    let canAutoApprove    = false;
    let shouldAutoDispute = false;

    if (noGR) {
      status = MatchStatus.MISSING_GR;
      recommendations.push('⚠️ Aucun bon de réception : attendre la livraison avant validation.');
    } else if (hasOverInvoiced) {
      status            = MatchStatus.OVER_INVOICED;
      shouldAutoDispute = true;
      recommendations.push('🚨 LITIGE : Quantité facturée > quantité reçue. Contacter le fournisseur immédiatement.');
    } else if (invoicedTotal > receivedTotal && discrepancyPct > TOLERANCE_PCT) {
      // Surfacturation : problème critique
      status            = MatchStatus.OVER_INVOICED;
      shouldAutoDispute = discrepancyPct > 5;
      recommendations.push(`🚨 SURFACTURATION de ${Math.abs(totalDiscrep).toFixed(3)} TND (${discrepancyPct.toFixed(2)}%). Mise en litige ${discrepancyPct > 5 ? 'automatique' : 'recommandée'}.`);
    } else if (hasNotReceived) {
      status = MatchStatus.MISSING_GR;
      recommendations.push('⚠️ Certains articles ne sont pas encore réceptionnés. Attendre la livraison complète.');
    } else if (hasQtyMismatch) {
      status            = MatchStatus.MISMATCH;
      shouldAutoDispute = discrepancyPct > 5;
      recommendations.push(`⚠️ Écart de quantité détecté (${discrepancyPct.toFixed(2)}%). ${discrepancyPct > 5 ? 'Litige automatique.' : 'Vérification manuelle requise.'}`);
    } else if (discrepancyPct <= TOLERANCE_PCT) {
      // Facture correspond à la réception (même si réception partielle)
      status         = allOk ? MatchStatus.MATCHED : MatchStatus.PARTIAL_MATCH;
      canAutoApprove = true;
      
      if (receivedTotal < poTotal) {
        // Réception partielle mais facture correcte
        const remaining = this.round(poTotal - receivedTotal);
        recommendations.push(`✅ Réception partielle : facture conforme à la livraison. Reste à recevoir : ${remaining.toFixed(3)} TND.`);
      } else if (invoicedTotal < receivedTotal) {
        // Sous-facturation (remise ou avoir)
        recommendations.push(`✅ Sous-facturation de ${Math.abs(totalDiscrep).toFixed(3)} TND détectée. Vérifier si remise ou avoir appliqué.`);
      } else {
        // Correspondance parfaite
        recommendations.push('✅ Rapprochement parfait : BC = BR = Facture. Approbation automatique recommandée.');
      }
    } else {
      status = MatchStatus.PARTIAL_MATCH;
      recommendations.push(`ℹ️ Écart mineur de ${discrepancyPct.toFixed(2)}%. Vérification manuelle recommandée avant approbation.`);
    }

    const result = this.buildResult(invoice, po, goodsReceipts, {
      status, can_auto_approve: canAutoApprove,
      should_auto_dispute: shouldAutoDispute,
      po_total: poTotal, received_total: receivedTotal,
      invoiced_total: invoicedTotal, total_discrepancy: totalDiscrep,
      discrepancy_pct: discrepancyPct, line_discrepancies: lineDiscrepancies,
      issues, recommendations, gr_numbers: grNumbers,
    });

    // 9. Analyse IA si demandée
    // TEMPORAIREMENT DÉSACTIVÉ : Gemini retourne du JSON mal formaté
    // Utilisation de l'analyse de secours (règles métier) à la place
    if (useAI) {
      try {
        // const aiAnalysis = await this.aiService.analyzeMatching(result);
        const aiAnalysis = this.aiService['getFallbackAnalysis'](result);
        result.ai_analysis = aiAnalysis;

        // Ajuster les recommandations basées sur l'IA
        if (aiAnalysis.recommended_action === 'AUTO_APPROVE' && aiAnalysis.confidence_score >= 85) {
          result.can_auto_approve = true;
          result.should_auto_dispute = false;
        } else if (aiAnalysis.recommended_action === 'AUTO_DISPUTE' && aiAnalysis.confidence_score >= 70) {
          result.can_auto_approve = false;
          result.should_auto_dispute = true;
        } else if (aiAnalysis.recommended_action === 'MANUAL_REVIEW') {
          result.can_auto_approve = false;
          result.should_auto_dispute = false;
        }

        this.logger.log(
          `Analyse IA : ${aiAnalysis.recommended_action} (confiance: ${aiAnalysis.confidence_score}%, risque: ${aiAnalysis.risk_level})`,
        );
      } catch (error: any) {
        this.logger.warn(`Analyse IA échouée : ${error.message} — utilisation des règles standards`);
      }
    }

    // 10. Action automatique si demandée
    if (autoAction) await this.applyAutoAction(result, businessId, invoiceId);

    this.logger.log(
      `Rapprochement ${invoice.invoice_number_supplier} : ${status} (écart ${discrepancyPct.toFixed(2)}%)`,
    );

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rapprochement de toutes les factures PENDING d'un business
  // ─────────────────────────────────────────────────────────────────────────
  async matchAllPending(
    businessId: string,
    autoAction: boolean = false,
    useAI:      boolean = true,
  ): Promise<ThreeWayMatchResult[]> {
    const pendingInvoices = await this.invoiceRepo.find({
      where: { business_id: businessId, status: InvoiceStatus.PENDING },
    });

    const results: ThreeWayMatchResult[] = [];
    for (const inv of pendingInvoices) {
      try {
        const result = await this.matchInvoice(businessId, inv.id, autoAction, useAI);
        results.push(result);
      } catch (err: any) {
        this.logger.error(`Erreur rapprochement facture ${inv.id} : ${err.message}`);
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Appliquer l'action automatique
  // ─────────────────────────────────────────────────────────────────────────
  private async applyAutoAction(
    result:     ThreeWayMatchResult,
    businessId: string,
    invoiceId:  string,
  ): Promise<void> {
    if (result.can_auto_approve) {
      await this.invoiceRepo.update(
        { id: invoiceId, business_id: businessId },
        { status: InvoiceStatus.APPROVED },
      );
      this.logger.log(`Facture ${result.invoice_number} approuvée automatiquement.`);
    } else if (result.should_auto_dispute) {
      // Construire une raison de litige claire avec l'analyse IA si disponible
      let reason = '';
      
      if (result.ai_analysis) {
        const category = result.ai_analysis.dispute_category 
          ? `[${result.ai_analysis.dispute_category}] ` 
          : '';
        reason = `${category}${result.ai_analysis.explanation}`;
      } else {
        reason = result.issues.slice(0, 2).join(' | ');
      }

      await this.invoiceRepo.update(
        { id: invoiceId, business_id: businessId },
        { 
          status: InvoiceStatus.DISPUTED, 
          dispute_reason: `[Rapprochement auto] ${reason}`,
        },
      );
      this.logger.log(`Facture ${result.invoice_number} mise en litige automatiquement : ${reason}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  private buildResult(
    invoice:  PurchaseInvoice,
    po:       SupplierPO | null,
    grs:      GoodsReceipt[],
    data:     Omit<ThreeWayMatchResult, 'invoice_id'|'invoice_number'|'supplier_name'|'po_number'|'gr_numbers'|'matching_date'> & { gr_numbers: string[] },
  ): ThreeWayMatchResult {
    // FIX: extraire gr_numbers de data avant le spread pour eviter la duplication
    const { gr_numbers, ...rest } = data;
    
    // Ajouter une note explicative sur le timbre fiscal dans les recommandations
    const recommendations = [...rest.recommendations];
    if (rest.received_total > 0) {
      recommendations.push('Note : Le montant réceptionné inclut le timbre fiscal (1.000 TND) qui est obligatoire sur toute facture.');
    }
    
    return {
      invoice_id:     invoice.id,
      invoice_number: invoice.invoice_number_supplier,
      supplier_name:  invoice.supplier?.name ?? '',
      po_number:      po?.po_number ?? null,
      gr_numbers,
      matching_date:  new Date(),
      ...rest,
      recommendations,
    };
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}