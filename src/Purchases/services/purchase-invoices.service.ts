// src/Purchases/services/purchase-invoices.service.ts
//hedi s7i7a

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository }     from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { PurchaseInvoice }           from '../entities/purchase-invoice.entity';
import { InvoiceStatus }             from '../enum/invoice-status.enum';
import { CreatePurchaseInvoiceDto }  from '../dto/create-purchase-invoice.dto';
import {
  DisputeInvoiceDto,
  UpdatePaymentAmountDto,
  UpdatePurchaseInvoiceDto,
} from '../dto/update-purchase-invoice.dto';

// Whitelist des champs triables — évite l'injection SQL via ORDER BY
const SORTABLE_FIELDS: Record<string, string> = {
  invoice_number_supplier: 'inv.invoice_number_supplier',
  invoice_date:            'inv.invoice_date',
  due_date:                'inv.due_date',
  net_amount:              'inv.net_amount',
  supplier:                'supplier.name',
};

@Injectable()
export class PurchaseInvoicesService {

  private readonly logger = new Logger(PurchaseInvoicesService.name);

  constructor(
    @InjectRepository(PurchaseInvoice)
    private readonly invRepo: Repository<PurchaseInvoice>,
  ) {}

  // ─── CREATE ───────────────────────────────────────────────────────────────────
  async create(businessId: string, dto: CreatePurchaseInvoiceDto): Promise<PurchaseInvoice> {
    const timbre    = dto.timbre_fiscal ?? 1.000;
    const net       = this.round(dto.subtotal_ht + dto.tax_amount + timbre);
    const dueDelta  = 30; // jours par défaut — à lire depuis Supplier.payment_terms si dispo

    const dueDate = dto.due_date
      ? new Date(dto.due_date)
      : new Date(new Date(dto.invoice_date).getTime() + dueDelta * 86_400_000);

    const inv = this.invRepo.create({
      ...dto,
      business_id:   businessId,
      timbre_fiscal: timbre,
      net_amount:    net,
      paid_amount:   0,
      status:        InvoiceStatus.PENDING,
      due_date:      dueDate,
    });

    return this.invRepo.save(inv);
  }
  // ─── FIND ALL (avec tri côté backend) ─────────────────────────────────────────
  async findAll(businessId: string, query: any) {
    const {
      status, supplier_id, date_from, date_to, due_before,
      // ANOMALIE 4 : nouveaux paramètres de tri
      sort_field = 'invoice_date',
      sort_dir   = 'desc',
      page  = 1,
      limit = 20,
    } = query;

    const qb = this.invRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.supplier', 'supplier')
      .where('inv.business_id = :businessId', { businessId });

    if (status) {
      const statuses = String(status).split(',').map(s => s.trim());
      qb.andWhere('inv.status IN (:...statuses)', { statuses });
    }
    if (supplier_id) qb.andWhere('inv.supplier_id = :supplier_id', { supplier_id });
    if (date_from)   qb.andWhere('inv.invoice_date >= :date_from', { date_from });
    if (date_to)     qb.andWhere('inv.invoice_date <= :date_to',   { date_to });
    if (due_before)  qb.andWhere('inv.due_date <= :due_before',    { due_before });

    // ANOMALIE 4 : tri validé par whitelist puis appliqué globalement
    const orderColumn = SORTABLE_FIELDS[sort_field] ?? 'inv.invoice_date';
    const orderDir    = sort_dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(orderColumn, orderDir);

    const skip = (Number(page) - 1) * Number(limit);
    qb.skip(skip).take(Number(limit));

    const [data, total] = await qb.getManyAndCount();
    const total_pages   = Math.ceil(total / Number(limit));

    return { data, total, page: Number(page), limit: Number(limit), total_pages };
  }

  // ─── FIND ONE ─────────────────────────────────────────────────────────────────
  async findOne(businessId: string, id: string): Promise<PurchaseInvoice> {
    const inv = await this.invRepo.findOne({
      where:     { id, business_id: businessId },
      relations: ['supplier', 'supplier_po'],
    });
    if (!inv) throw new NotFoundException(`Facture introuvable (id: ${id})`);
    return inv;
  }

  // ─── FIND BY PO (vérifier si des factures existent pour un BC) ───────────────
  async findByPO(businessId: string, poId: string): Promise<PurchaseInvoice[]> {
    return this.invRepo.find({
      where:     { business_id: businessId, supplier_po_id: poId },
      relations: ['supplier'],
      order:     { created_at: 'DESC' },
    });
  }

  // ─── UPDATE (PENDING seulement) ───────────────────────────────────────────────
  async update(businessId: string, id: string, dto: UpdatePurchaseInvoiceDto): Promise<PurchaseInvoice> {
    const inv = await this.findOne(businessId, id);
    if (inv.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException(
        `Modification impossible. Statut actuel : ${inv.status}. Requis : PENDING.`,
      );
    }

    Object.assign(inv, dto);

    // Recalcul net_amount si les montants ont changé
    const timbre = Number(inv.timbre_fiscal) || 1.000;
    inv.net_amount = this.round(
      Number(inv.subtotal_ht) + Number(inv.tax_amount) + timbre,
    );

    return this.invRepo.save(inv);
  }

  // ─── APPROVE ──────────────────────────────────────────────────────────────────
async approve(businessId: string, id: string): Promise<PurchaseInvoice> {
  const inv = await this.findOne(businessId, id);

  if (inv.status !== InvoiceStatus.PENDING) {
    throw new BadRequestException(
      `Approbation impossible. Statut : ${inv.status}. Requis : PENDING.`,
    );
  }

  // Recalculer net_amount au cas où il aurait été modifié
  const net = Math.round(
    (Number(inv.subtotal_ht) + Number(inv.tax_amount) + Number(inv.timbre_fiscal)) * 1000,
  ) / 1000;
  inv.net_amount = net;
  inv.status = InvoiceStatus.APPROVED;

  return this.invRepo.save(inv);
}

  // ─── DISPUTE ──────────────────────────────────────────────────────────────────
  async dispute(businessId: string, id: string, dto: DisputeInvoiceDto): Promise<PurchaseInvoice> {
    const inv = await this.findOne(businessId, id);
    if (inv.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Impossible de mettre en litige une facture déjà payée.');
    }
    inv.status         = InvoiceStatus.DISPUTED;
    inv.dispute_reason = dto.dispute_reason;
    return this.invRepo.save(inv);
  }

  // ─── RESOLVE DISPUTE ──────────────────────────────────────────────────────────
  async resolveDispute(businessId: string, id: string): Promise<PurchaseInvoice> {
    const inv = await this.findOne(businessId, id);
    if (inv.status !== InvoiceStatus.DISPUTED) {
      throw new BadRequestException(
        `Résolution impossible. Statut actuel : ${inv.status}. Requis : DISPUTED.`,
      );
    }
    inv.status         = InvoiceStatus.APPROVED;
    inv.dispute_reason = null;
    return this.invRepo.save(inv);
  }

  // ─── UPDATE PAYMENT (appelé par Module Trésorerie) ────────────────────────────
  async updatePayment(
    businessId: string,
    id: string,
    dto: UpdatePaymentAmountDto,
  ): Promise<PurchaseInvoice> {
    const inv = await this.findOne(businessId, id);

    // ANOMALIE 1 FIX: Validation du montant AVANT toute logique
    if (dto.paid_amount < 0) {
      throw new BadRequestException('Le montant payé ne peut pas être négatif.');
    }

    if (dto.paid_amount > Number(inv.net_amount)) {
      throw new BadRequestException(
        `Le montant payé (${dto.paid_amount}) dépasse le net TTC (${inv.net_amount}).`,
      );
    }

    inv.paid_amount = dto.paid_amount;

    // ANOMALIE 2 FIX: Logique de statut corrigée (if/else if/else)
    if (dto.paid_amount >= Number(inv.net_amount)) {
      inv.status = InvoiceStatus.PAID;
    } else if (dto.paid_amount > 0) {
      inv.status = InvoiceStatus.PARTIALLY_PAID;
    } else {
      inv.status = InvoiceStatus.APPROVED; // Retour à APPROVED si paid_amount = 0
    }

    return this.invRepo.save(inv);
  }

  // ─── CRON : passer en OVERDUE les factures échues ────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async markOverdue(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueStatuses = [
      InvoiceStatus.PENDING,
      InvoiceStatus.APPROVED,
      InvoiceStatus.PARTIALLY_PAID,
    ];

    const result = await this.invRepo
      .createQueryBuilder()
      .update(PurchaseInvoice)
      .set({ status: InvoiceStatus.OVERDUE })
      .where('status IN (:...statuses)', { statuses: overdueStatuses })
      .andWhere('due_date < :today', { today })
      .execute();

    if (result.affected) {
      this.logger.log(`${result.affected} facture(s) passée(s) en OVERDUE.`);
    }
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }



////////treasury////////
// ─── FIND APPROVED OR PARTIALLY_PAID ──────────────────────────────────────────
async findApprovedOrPartial(businessId: string, query: any = {}) {
  const {
    sort_field = 'due_date',
    sort_dir   = 'asc',
    page = 1,
    limit = 20
  } = query;

  const qb = this.invRepo
    .createQueryBuilder('inv')
    .leftJoinAndSelect('inv.supplier', 'supplier')
    .where('inv.business_id = :businessId', { businessId })
    .andWhere('inv.status IN (:...statuses)', {
      statuses: [InvoiceStatus.APPROVED, InvoiceStatus.PARTIALLY_PAID]
    });

  // Apply whitelist sorting
  const orderColumn = SORTABLE_FIELDS[sort_field] ?? 'inv.due_date';
  const orderDir = sort_dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  qb.orderBy(orderColumn, orderDir);

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);
  qb.skip(skip).take(Number(limit));

  const [data, total] = await qb.getManyAndCount();
  const total_pages = Math.ceil(total / Number(limit));

  return { data, total, page: Number(page), limit: Number(limit), total_pages };
}
////////treasury////////
}
