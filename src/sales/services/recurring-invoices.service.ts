import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RecurringInvoice, RecurringFrequency, RecurringInvoiceStatus, DiscountType } from '../entities/recurring-invoice.entity';
import { CreateRecurringInvoiceDto } from '../dto/create-recurring-invoice.dto';
import { UpdateRecurringInvoiceDto } from '../dto/update-recurring-invoice.dto';
import { QueryRecurringInvoicesDto } from '../dto/query-recurring-invoices.dto';
import { BulkUpdateRecurringInvoicesDto } from '../dto/bulk-update-recurring-invoices.dto';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class RecurringInvoicesService {
  constructor(
    @InjectRepository(RecurringInvoice)
    private readonly repo: Repository<RecurringInvoice>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async create(businessId: string, dto: CreateRecurringInvoiceDto) {
    // Valider la remise si présente
    if (dto.discount_type && dto.discount_value != null) {
      if (dto.discount_type === DiscountType.PERCENTAGE && (dto.discount_value < 0 || dto.discount_value > 100)) {
        throw new BadRequestException('Le pourcentage de remise doit être entre 0 et 100');
      }
      if (dto.discount_type === DiscountType.FIXED && dto.discount_value < 0) {
        throw new BadRequestException('La remise fixe ne peut pas être négative');
      }
    }

    const recurring = this.repo.create({
      ...dto,
      business_id: businessId,
      next_invoice_date: dto.start_date,
      status: RecurringInvoiceStatus.ACTIVE,
    });
    return this.repo.save(recurring);
  }

  async findAll(businessId: string, query: QueryRecurringInvoicesDto) {
    const { status, frequency, search, page = 1, limit = 20 } = query;

    const qb = this.repo
      .createQueryBuilder('ri')
      .leftJoinAndSelect('ri.client', 'client')
      .where('ri.business_id = :businessId', { businessId })
      .orderBy('ri.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status !== undefined) {
      qb.andWhere('ri.status = :status', { status });
    }

    if (frequency) {
      qb.andWhere('ri.frequency = :frequency', { frequency });
    }

    if (search) {
      qb.andWhere(
        '(ri.description ILIKE :search OR client.name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string) {
    const recurring = await this.repo.findOne({
      where: { id, business_id: businessId },
      relations: ['client'],
    });

    if (!recurring) {
      throw new NotFoundException('Facture récurrente introuvable');
    }

    return recurring;
  }

  async update(businessId: string, id: string, dto: UpdateRecurringInvoiceDto) {
    const recurring = await this.findOne(businessId, id);
    Object.assign(recurring, dto);
    return this.repo.save(recurring);
  }

  async remove(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    await this.repo.remove(recurring);
  }

  async activate(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    recurring.status = RecurringInvoiceStatus.ACTIVE;
    return this.repo.save(recurring);
  }

  async deactivate(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    recurring.status = RecurringInvoiceStatus.INACTIVE;
    return this.repo.save(recurring);
  }

  async pause(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    recurring.status = RecurringInvoiceStatus.PAUSED;
    return this.repo.save(recurring);
  }

  async resume(businessId: string, id: string) {
    const recurring = await this.findOne(businessId, id);
    recurring.status = RecurringInvoiceStatus.ACTIVE;
    return this.repo.save(recurring);
  }

  async getStats(businessId: string) {
    const qb = this.repo
      .createQueryBuilder('ri')
      .where('ri.business_id = :businessId', { businessId });

    const [total_active, total_inactive, total_paused] = await Promise.all([
      qb.clone().andWhere('ri.status = :status', { status: RecurringInvoiceStatus.ACTIVE }).getCount(),
      qb.clone().andWhere('ri.status = :status', { status: RecurringInvoiceStatus.INACTIVE }).getCount(),
      qb.clone().andWhere('ri.status = :status', { status: RecurringInvoiceStatus.PAUSED }).getCount(),
    ]);

    // Calculer le revenu mensuel prévisionnel
    const activeRecurring = await qb
      .clone()
      .andWhere('ri.status = :status', { status: RecurringInvoiceStatus.ACTIVE })
      .getMany();

    let monthly_revenue_forecast = 0;
    for (const ri of activeRecurring) {
      const amount = this.applyDiscount(Number(ri.amount), ri.discount_type, ri.discount_value ? Number(ri.discount_value) : null);
      const monthlyAmount = this.normalizeToMonthly(amount, ri.frequency);
      monthly_revenue_forecast += monthlyAmount;
    }

    // Factures générées ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const invoices_generated_this_month = await this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.recurring_invoice_id IS NOT NULL')
      .andWhere('inv.created_at >= :startOfMonth', { startOfMonth })
      .getCount();

    const total = total_active + total_inactive + total_paused;
    const activation_rate = total > 0 ? (total_active / total) * 100 : 0;

    return {
      total_active,
      total_inactive,
      total_paused,
      monthly_revenue_forecast: Math.round(monthly_revenue_forecast * 1000) / 1000,
      invoices_generated_this_month,
      activation_rate: Math.round(activation_rate * 10) / 10,
    };
  }

  async bulkUpdate(businessId: string, dto: BulkUpdateRecurringInvoicesDto) {
    const { ids, action } = dto;

    // Vérifier que toutes les factures appartiennent au business
    const count = await this.repo.count({
      where: { id: In(ids), business_id: businessId },
    });

    if (count !== ids.length) {
      throw new BadRequestException('Certaines factures récurrentes sont introuvables');
    }

    switch (action) {
      case 'activate':
        await this.repo.update(
          { id: In(ids), business_id: businessId },
          { status: RecurringInvoiceStatus.ACTIVE }
        );
        break;
      case 'pause':
        await this.repo.update(
          { id: In(ids), business_id: businessId },
          { status: RecurringInvoiceStatus.PAUSED }
        );
        break;
      case 'delete':
        await this.repo.delete({ id: In(ids), business_id: businessId });
        break;
    }

    return { success: true, affected: ids.length };
  }

  async getInvoiceHistory(businessId: string, recurringId: string, page = 1, limit = 10) {
    // Vérifier que la facture récurrente existe et appartient au business
    await this.findOne(businessId, recurringId);

    const [data, total] = await this.invoiceRepo.findAndCount({
      where: {
        business_id: businessId,
        recurring_invoice_id: recurringId,
      },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'invoice_number', 'created_at', 'total_ttc', 'status'],
    });

    const total_pages = Math.ceil(total / limit);

    return { data, total, page, limit, total_pages };
  }

  private applyDiscount(amount: number, type: DiscountType | null, value: number | null): number {
    if (!type || value == null) return amount;
    if (type === DiscountType.PERCENTAGE) return amount * (1 - value / 100);
    if (type === DiscountType.FIXED) return Math.max(0, amount - value);
    return amount;
  }

  private normalizeToMonthly(amount: number, frequency: RecurringFrequency): number {
    switch (frequency) {
      case RecurringFrequency.DAILY:
        return amount * 30;
      case RecurringFrequency.WEEKLY:
        return amount * 4.33;
      case RecurringFrequency.MONTHLY:
        return amount;
      case RecurringFrequency.QUARTERLY:
        return amount / 3;
      case RecurringFrequency.YEARLY:
        return amount / 12;
      default:
        return amount;
    }
  }

  calculateNextDate(currentDate: Date, frequency: RecurringFrequency): Date {
    const next = new Date(currentDate);

    switch (frequency) {
      case RecurringFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case RecurringFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case RecurringFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case RecurringFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3);
        break;
      case RecurringFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  async generateTestInvoice(businessId: string, recurringId: string) {
    const recurring = await this.findOne(businessId, recurringId);
    
    // Générer un numéro de facture unique
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const count = await this.invoiceRepo.count({
      where: { business_id: businessId },
    });
    const invoiceNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;

    // Appliquer la remise
    const baseAmount = Number(recurring.amount);
    const subtotal_ht = this.applyDiscount(
      baseAmount,
      recurring.discount_type,
      recurring.discount_value ? Number(recurring.discount_value) : null
    );
    
    const tax_amount = subtotal_ht * (Number(recurring.tax_rate) / 100);
    const timbre_fiscal = 1.000;
    const total_ttc = subtotal_ht + tax_amount;
    const net_amount = total_ttc + timbre_fiscal;

    // Créer la facture
    const invoice = this.invoiceRepo.create({
      business_id: recurring.business_id,
      client_id: recurring.client_id,
      recurring_invoice_id: recurring.id,
      invoice_number: invoiceNumber,
      type: 'NORMAL' as any,
      date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'DRAFT' as any,
      subtotal_ht,
      tax_amount,
      timbre_fiscal,
      total_ttc,
      net_amount,
      paid_amount: 0,
      notes: `Facture test - ${recurring.description}`,
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // Mettre à jour le compteur
    recurring.invoices_generated += 1;
    await this.repo.save(recurring);

    return {
      message: 'Facture de test générée avec succès',
      invoice: savedInvoice,
    };
  }
}
