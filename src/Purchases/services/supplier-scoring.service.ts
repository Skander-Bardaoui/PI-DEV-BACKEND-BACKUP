// src/Purchases/services/supplier-scoring.service.ts
//
// Score fournisseur de 0 à 100 basé sur 5 critères pondérés :
// 1. Rapidité de confirmation BC       (20 pts) — délai moyen SENT→CONFIRMED
// 2. Taux de livraison conforme        (25 pts) — qté reçue / qté commandée
// 3. Respect des délais de livraison   (20 pts) — livré avant expected_delivery
// 4. Taux de litiges                   (20 pts) — factures disputées / total factures
// 5. Historique de paiement            (15 pts) — factures payées dans les délais

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import { Supplier }           from '../entities/supplier.entity';
import { SupplierPO }         from '../entities/supplier-po.entity';
import { GoodsReceipt }       from '../entities/goods-receipt.entity';
import { PurchaseInvoice }    from '../entities/purchase-invoice.entity';
import { POStatus }           from '../enum/po-status.enum';
import { InvoiceStatus }      from '../enum/invoice-status.enum';
import { SupplierPayment } from '../../payments/entities/supplier-payment.entity';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoreCriteria {
  name:        string;
  score:       number;   // score obtenu pour ce critère (0-100)
  weight:      number;   // poids en % (somme = 100)
  weighted:    number;   // score × poids / 100
  label:       string;   // description lisible
  detail:      string;   // explication du calcul
}

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SupplierScore {
  supplier_id:   string;
  supplier_name: string;
  total_score:   number;     // 0-100
  grade:         ScoreGrade; // A/B/C/D/F
  criteria:      ScoreCriteria[];
  stats: {
    total_pos:              number;
    confirmed_pos:          number;
    avg_confirmation_days:  number;
    total_items_ordered:    number;
    total_items_received:   number;
    delivery_rate_pct:      number;
    on_time_deliveries:     number;
    total_deliveries:       number;
    on_time_rate_pct:       number;
    total_invoices:         number;
    disputed_invoices:      number;
    dispute_rate_pct:       number;
    total_invoiced:         number;
    total_paid:             number;
    payment_rate_pct:       number;
    avg_payment_days:       number;
  };
  computed_at: Date;
}

export interface SupplierRanking {
  rank:          number;
  supplier_id:   string;
  supplier_name: string;
  total_score:   number;
  grade:         ScoreGrade;
  trend:         'up' | 'down' | 'stable'; // comparaison vs mois précédent (simplifié)
}

// ─── Calcul grade ─────────────────────────────────────────────────────────────
function getGrade(score: number): ScoreGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

@Injectable()
export class SupplierScoringService {

  private readonly logger = new Logger(SupplierScoringService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(SupplierPO)
    private readonly poRepo: Repository<SupplierPO>,

    @InjectRepository(GoodsReceipt)
    private readonly grRepo: Repository<GoodsReceipt>,

    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepo: Repository<PurchaseInvoice>,

    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,
  ) {}

  // ─── Score d'un fournisseur ───────────────────────────────────────────────
  async scoreSupplier(businessId: string, supplierId: string): Promise<SupplierScore> {
    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId, business_id: businessId },
    });
    if (!supplier) throw new Error(`Fournisseur introuvable (id: ${supplierId})`);

    const [c1, s1] = await this.scoreConfirmationSpeed(businessId, supplierId);
    const [c2, s2] = await this.scoreDeliveryRate(businessId, supplierId);
    const [c3, s3] = await this.scoreOnTimeDelivery(businessId, supplierId);
    const [c4, s4] = await this.scoreDisputeRate(businessId, supplierId);
    const [c5, s5] = await this.scorePaymentHistory(businessId, supplierId);

    const criteria = [c1, c2, c3, c4, c5];
    const totalScore = Math.round(criteria.reduce((sum, c) => sum + c.weighted, 0));

    // Fusionner toutes les stats
    const stats = { ...s1, ...s2, ...s3, ...s4, ...s5 };

    return {
      supplier_id:   supplierId,
      supplier_name: supplier.name,
      total_score:   totalScore,
      grade:         getGrade(totalScore),
      criteria,
      stats,
      computed_at:   new Date(),
    };
  }

  // ─── Classement de tous les fournisseurs ─────────────────────────────────
  async rankSuppliers(businessId: string): Promise<SupplierRanking[]> {
    const suppliers = await this.supplierRepo.find({
      where: { business_id: businessId, is_active: true },
    });

    const scores = await Promise.all(
      suppliers.map(async s => {
        try {
          const score = await this.scoreSupplier(businessId, s.id);
          return { supplier_id: s.id, supplier_name: s.name, total_score: score.total_score, grade: score.grade };
        } catch {
          return { supplier_id: s.id, supplier_name: s.name, total_score: 0, grade: 'F' as ScoreGrade };
        }
      }),
    );

    return scores
      .sort((a, b) => b.total_score - a.total_score)
      .map((s, i) => ({ ...s, rank: i + 1, trend: 'stable' as const }));
  }

  // ─── CRITÈRE 1 : Rapidité de confirmation BC (poids 20%) ─────────────────
  private async scoreConfirmationSpeed(
    businessId: string, supplierId: string,
  ): Promise<[ScoreCriteria, Pick<SupplierScore['stats'], 'total_pos' | 'confirmed_pos' | 'avg_confirmation_days'>]> {

    const pos = await this.poRepo.find({
      where: { business_id: businessId, supplier_id: supplierId },
    });

    const total_pos     = pos.length;
    const confirmedPOs  = pos.filter(p =>
      p.status !== POStatus.DRAFT &&
      p.status !== POStatus.CANCELLED &&
      p.sent_at,
    );
    const confirmed_pos = confirmedPOs.length;

    let avg_confirmation_days = 0;
    if (confirmedPOs.length > 0) {
      const totalDays = confirmedPOs.reduce((sum, po) => {
        if (!po.sent_at) return sum;
        const sent     = new Date(po.sent_at).getTime();
        const updated  = new Date(po.updated_at).getTime();
        const days     = Math.max(0, (updated - sent) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      avg_confirmation_days = Math.round((totalDays / confirmedPOs.length) * 10) / 10;
    }

    // Score : < 1 jour = 100, < 2 jours = 85, < 3 jours = 70, < 7 jours = 50, >= 7 jours = 20
    let score = 100;
    if      (avg_confirmation_days === 0)  score = 100; // pas encore envoyé
    else if (avg_confirmation_days < 1)    score = 100;
    else if (avg_confirmation_days < 2)    score = 85;
    else if (avg_confirmation_days < 3)    score = 70;
    else if (avg_confirmation_days < 7)    score = 50;
    else                                   score = 20;

    if (confirmed_pos === 0) score = 50; // pas assez de données

    const weighted = Math.round(score * 20 / 100);

    return [
      {
        name:    'Rapidité de confirmation',
        score,
        weight:  20,
        weighted,
        label:   avg_confirmation_days > 0 ? `${avg_confirmation_days}j en moyenne` : 'Pas de données',
        detail:  `${confirmed_pos} BC confirmés sur ${total_pos} total`,
      },
      { total_pos, confirmed_pos, avg_confirmation_days },
    ];
  }

  // ─── CRITÈRE 2 : Taux de livraison conforme (poids 25%) ──────────────────
  private async scoreDeliveryRate(
    businessId: string, supplierId: string,
  ): Promise<[ScoreCriteria, Pick<SupplierScore['stats'], 'total_items_ordered' | 'total_items_received' | 'delivery_rate_pct'>]> {

    const pos = await this.poRepo.find({
      where:     { business_id: businessId, supplier_id: supplierId },
      relations: ['items'],
    });

    let total_items_ordered  = 0;
    let total_items_received = 0;

    for (const po of pos) {
      for (const item of (po.items ?? [])) {
        total_items_ordered  += Number(item.quantity_ordered);
        total_items_received += Number(item.quantity_received);
      }
    }

    const delivery_rate_pct = total_items_ordered > 0
      ? Math.round((total_items_received / total_items_ordered) * 100 * 10) / 10
      : 0;

    let score = 0;
    if      (delivery_rate_pct >= 98) score = 100;
    else if (delivery_rate_pct >= 95) score = 85;
    else if (delivery_rate_pct >= 90) score = 70;
    else if (delivery_rate_pct >= 80) score = 50;
    else if (delivery_rate_pct >= 70) score = 30;
    else                              score = 10;

    if (total_items_ordered === 0) score = 50;

    const weighted = Math.round(score * 25 / 100);

    return [
      {
        name:    'Taux de livraison',
        score,
        weight:  25,
        weighted,
        label:   `${delivery_rate_pct}% livré`,
        detail:  `${total_items_received} / ${total_items_ordered} unités réceptionnées`,
      },
      { total_items_ordered, total_items_received, delivery_rate_pct },
    ];
  }

  // ─── CRITÈRE 3 : Respect des délais de livraison (poids 20%) ─────────────
  private async scoreOnTimeDelivery(
    businessId: string, supplierId: string,
  ): Promise<[ScoreCriteria, Pick<SupplierScore['stats'], 'on_time_deliveries' | 'total_deliveries' | 'on_time_rate_pct'>]> {

    // Récupérer tous les GR avec leurs PO
    const grs = await this.grRepo.find({
      where: { business_id: businessId },
      relations: ['supplier_po'],
    });

    // Filtrer les GR qui appartiennent au fournisseur
    const supplierGRs = grs.filter(gr => gr.supplier_po?.supplier_id === supplierId);

    const total_deliveries = supplierGRs.length;
    let   on_time_deliveries = 0;

    for (const gr of supplierGRs) {
      if (!gr.supplier_po?.expected_delivery) {
        on_time_deliveries++; // pas de date prévue = pas de retard
        continue;
      }
      const expected = new Date(gr.supplier_po.expected_delivery);
      const received = new Date(gr.receipt_date);
      if (received <= expected) on_time_deliveries++;
    }

    const on_time_rate_pct = total_deliveries > 0
      ? Math.round((on_time_deliveries / total_deliveries) * 100 * 10) / 10
      : 100;

    let score = 0;
    if      (on_time_rate_pct >= 95) score = 100;
    else if (on_time_rate_pct >= 85) score = 80;
    else if (on_time_rate_pct >= 75) score = 60;
    else if (on_time_rate_pct >= 60) score = 40;
    else                             score = 20;

    if (total_deliveries === 0) score = 50;

    const weighted = Math.round(score * 20 / 100);

    return [
      {
        name:    'Respect des délais',
        score,
        weight:  20,
        weighted,
        label:   `${on_time_rate_pct}% à temps`,
        detail:  `${on_time_deliveries} / ${total_deliveries} livraisons dans les délais`,
      },
      { on_time_deliveries, total_deliveries, on_time_rate_pct },
    ];
  }

  // ─── CRITÈRE 4 : Taux de litiges (poids 20%) ─────────────────────────────
  private async scoreDisputeRate(
    businessId: string, supplierId: string,
  ): Promise<[ScoreCriteria, Pick<SupplierScore['stats'], 'total_invoices' | 'disputed_invoices' | 'dispute_rate_pct'>]> {

    const invoices = await this.invoiceRepo.find({
      where: { business_id: businessId, supplier_id: supplierId },
    });

    const total_invoices    = invoices.length;
    const disputed_invoices = invoices.filter(i =>
      i.status === InvoiceStatus.DISPUTED ||
      i.dispute_reason != null,
    ).length;

    const dispute_rate_pct = total_invoices > 0
      ? Math.round((disputed_invoices / total_invoices) * 100 * 10) / 10
      : 0;

    let score = 0;
    if      (dispute_rate_pct === 0) score = 100;
    else if (dispute_rate_pct < 2)   score = 85;
    else if (dispute_rate_pct < 5)   score = 65;
    else if (dispute_rate_pct < 10)  score = 40;
    else                             score = 10;

    if (total_invoices === 0) score = 50;

    const weighted = Math.round(score * 20 / 100);

    return [
      {
        name:    'Taux de litiges',
        score,
        weight:  20,
        weighted,
        label:   dispute_rate_pct === 0 ? 'Aucun litige' : `${dispute_rate_pct}% en litige`,
        detail:  `${disputed_invoices} litige(s) sur ${total_invoices} facture(s)`,
      },
      { total_invoices, disputed_invoices, dispute_rate_pct },
    ];
  }

  // ─── CRITÈRE 5 : Historique paiement (poids 15%) ─────────────────────────
  private async scorePaymentHistory(
    businessId: string, supplierId: string,
  ): Promise<[ScoreCriteria, Pick<SupplierScore['stats'], 'total_invoiced' | 'total_paid' | 'payment_rate_pct' | 'avg_payment_days'>]> {

    const invoices = await this.invoiceRepo.find({
      where: { business_id: businessId, supplier_id: supplierId },
    });

    const payments = await this.paymentRepo.find({
      where: { business_id: businessId, supplier_id: supplierId },
    });

    const total_invoiced = invoices.reduce((s, i) => s + Number(i.net_amount),  0);
    const total_paid     = payments.reduce((s, p) => s + Number(p.amount),      0);

    const payment_rate_pct = total_invoiced > 0
      ? Math.round((total_paid / total_invoiced) * 100 * 10) / 10
      : 100;

    // Délai moyen de paiement (invoice_date → payment_date)
    // IMPORTANT: Dans le module ACHATS, c'est VOUS qui payez le fournisseur
    // Un délai court = bon (vous payez rapidement)
    // Un délai long = mauvais (vous êtes en retard)
    let avg_payment_days = 0;
    if (payments.length > 0) {
      const pairedPayments = payments.filter(p => p.purchase_invoice_id);
      if (pairedPayments.length > 0) {
        const totalDays = pairedPayments.reduce((sum, p) => {
          const inv = invoices.find(i => i.id === p.purchase_invoice_id);
          if (!inv) return sum;
          const invoiceDate = new Date(inv.invoice_date).getTime();
          const paymentDate = new Date(p.payment_date).getTime();
          return sum + Math.max(0, (paymentDate - invoiceDate) / (1000 * 60 * 60 * 24));
        }, 0);
        avg_payment_days = Math.round((totalDays / pairedPayments.length) * 10) / 10;
      }
    }

    // Score basé sur le taux de paiement ET le délai
    // Plus vous payez bien et rapidement, meilleur est le score
    let score = payment_rate_pct >= 100 ? 100
              : payment_rate_pct >= 90  ? 80
              : payment_rate_pct >= 75  ? 60
              : payment_rate_pct >= 50  ? 40
              : 20;

    // Bonus si VOUS payez rapidement (< 30 jours)
    if (avg_payment_days > 0 && avg_payment_days <= 30) score = Math.min(100, score + 10);

    if (total_invoiced === 0) score = 50;

    const weighted = Math.round(score * 15 / 100);

    return [
      {
        name:    'Vos paiements fournisseur',
        score,
        weight:  15,
        weighted,
        label:   `${payment_rate_pct}% payé par vous`,
        detail:  `Vous avez payé ${total_paid.toFixed(3)} / ${total_invoiced.toFixed(3)} TND`,
      },
      { total_invoiced, total_paid, payment_rate_pct, avg_payment_days },
    ];
  }
}