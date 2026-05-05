import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoiceStatus, InvoiceType } from '../entities/invoice.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { SalesMailService } from './sales-mail.service';
import { SalesEmailAiService } from './sales-email-ai.service';

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PARTIALLY_PAID]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID],
  [InvoiceStatus.CANCELLED]: [],
};

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,

    private readonly dataSource: DataSource,
    private readonly mailService: SalesMailService,
    private readonly emailAiService: SalesEmailAiService,
  ) {}

  async create(businessId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoice_number = await this.generateNumber(businessId, manager);
      const { items: itemsDto, ...rest } = dto;
      const { subtotal_ht, tax_amount, net_amount, items } = this.calcTotals(itemsDto);

      const invoice = manager.create(Invoice, {
        ...rest,
        invoice_number,
        business_id: businessId,
        type: dto.type || InvoiceType.NORMAL,
        status: InvoiceStatus.DRAFT,
        subtotal_ht,
        tax_amount,
        timbre_fiscal: 1.000,
        total_ttc: subtotal_ht + tax_amount,
        net_amount,
        paid_amount: 0,
        date: dto.date ? new Date(dto.date) : new Date(),
        due_date: dto.due_date ? new Date(dto.due_date) : new Date(),
      });
      const saved = await manager.save(Invoice, invoice);

      const lines = items.map((item, i) =>
        manager.create(InvoiceItem, {
          ...item,
          invoice_id: saved.id,
          sort_order: item.sort_order ?? i,
        }),
      );
      await manager.save(InvoiceItem, lines);

      return manager.findOne(Invoice, {
        where: { id: saved.id },
        relations: ['items', 'client'],
      }) as Promise<Invoice>;
    });
  }

  async findAll(businessId: string, query: any) {
    const { client_id, status, type, search, page = 1, limit = 20 } = query;

    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .where('invoice.business_id = :businessId', { businessId })
      .orderBy('invoice.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim());
      qb.andWhere('invoice.status IN (:...statuses)', { statuses });
    }
    if (type) qb.andWhere('invoice.type = :type', { type });
    if (client_id) qb.andWhere('invoice.client_id = :client_id', { client_id });
    
    if (search) {
      qb.andWhere(
        '(invoice.invoice_number ILIKE :search OR client.name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, business_id: businessId },
      relations: ['items', 'client', 'business'],
    });
    if (!invoice) throw new NotFoundException(`Facture introuvable (id: ${id})`);
    return invoice;
  }

  async update(businessId: string, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(businessId, id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Modification impossible. Statut actuel : ${invoice.status}. Requis : DRAFT.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.due_date !== undefined)
        invoice.due_date = new Date(dto.due_date);
      if (dto.notes !== undefined)
        invoice.notes = dto.notes;

      if (dto.items?.length) {
        await manager.delete(InvoiceItem, { invoice_id: id });

        const { subtotal_ht, tax_amount, net_amount, items } = this.calcTotals(dto.items);
        invoice.subtotal_ht = subtotal_ht;
        invoice.tax_amount = tax_amount;
        invoice.total_ttc = subtotal_ht + tax_amount;
        invoice.net_amount = net_amount;

        await manager.save(Invoice, invoice);

        const lines = items.map((item, i) =>
          manager.create(InvoiceItem, {
            ...item,
            invoice_id: id,
            sort_order: item.sort_order ?? i,
          }),
        );
        await manager.save(InvoiceItem, lines);
      } else {
        await manager.save(Invoice, invoice);
      }

      return manager.findOne(Invoice, {
        where: { id },
        relations: ['items', 'client'],
      }) as Promise<Invoice>;
    });
  }

  async send(businessId: string, id: string) {
    return this.transition(businessId, id, InvoiceStatus.SENT, (inv) => {
      inv.sent_at = new Date();
    });
  }

  async sendByEmail(
    businessId: string, 
    id: string, 
    recipientEmail?: string,
    customSubject?: string,
    customBody?: string
  ): Promise<Invoice> {
    const invoice = await this.findOne(businessId, id);
    
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.SENT) {
      throw new BadRequestException(
        `Impossible d'envoyer la facture. Statut actuel : ${invoice.status}`,
      );
    }

    const email = recipientEmail || invoice.client?.email;
    if (!email) {
      throw new BadRequestException('Aucune adresse email fournie');
    }

    await this.mailService.sendInvoiceEmail(invoice, email, customSubject, customBody, undefined);

    if (invoice.status === InvoiceStatus.DRAFT) {
      return this.send(businessId, id);
    }

    return invoice;
  }

  async sendPaymentReminder(businessId: string, id: string, recipientEmail?: string): Promise<void> {
    const invoice = await this.findOne(businessId, id);
    
    if (invoice.status !== InvoiceStatus.OVERDUE && invoice.status !== InvoiceStatus.SENT) {
      throw new BadRequestException(
        `Impossible d'envoyer un rappel. Statut actuel : ${invoice.status}`,
      );
    }

    const email = recipientEmail || invoice.client?.email;
    if (!email) {
      throw new BadRequestException('Aucune adresse email fournie');
    }

    await this.mailService.sendPaymentReminder(invoice, email);
  }

  async generateEmailDraft(
    businessId: string,
    id: string,
    language: 'fr' | 'ar' = 'fr',
    isReminder: boolean = false,
  ): Promise<{ subject: string; body: string }> {
    const invoice = await this.findOne(businessId, id);

    const dueDate = new Date(invoice.due_date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const draft = await this.emailAiService.generateEmailDraft({
      clientName: invoice.client?.name || 'Client',
      invoiceNumber: invoice.invoice_number,
      amount: Number(invoice.net_amount),
      dueDate,
      isReminder,
      language,
      businessName: invoice.business?.name || 'Votre Entreprise',
    });

    return draft;
  }

  async markPartiallyPaid(businessId: string, id: string) {
    return this.transition(businessId, id, InvoiceStatus.PARTIALLY_PAID);
  }

  async markPaid(businessId: string, id: string) {
    return this.transition(businessId, id, InvoiceStatus.PAID);
  }

  async markOverdue(businessId: string, id: string) {
    return this.transition(businessId, id, InvoiceStatus.OVERDUE);
  }

  async cancel(businessId: string, id: string) {
    return this.transition(businessId, id, InvoiceStatus.CANCELLED);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const invoice = await this.findOne(businessId, id);
    
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Suppression impossible. Seules les factures en brouillon peuvent être supprimées. Statut actuel : ${invoice.status}`,
      );
    }

    // Check if invoice is referenced by a sales order
    const referencedOrder = await this.dataSource.query(
      `SELECT id FROM sales_orders WHERE "invoiceId" = $1`,
      [id]
    );

    if (referencedOrder && referencedOrder.length > 0) {
      throw new BadRequestException(
        `Suppression impossible. Cette facture est liée à une commande (ID: ${referencedOrder[0].id}). Vous devez d'abord supprimer ou modifier la commande.`,
      );
    }

    await this.invoiceRepo.delete({ id, business_id: businessId });
  }

  private async transition(
    businessId: string,
    id: string,
    target: InvoiceStatus,
    mutate?: (invoice: Invoice) => void,
  ): Promise<Invoice> {
    const invoice = await this.findOne(businessId, id);
    const allowed = TRANSITIONS[invoice.status];

    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition invalide : ${invoice.status} → ${target}. ` +
        `Autorisées : ${allowed.join(', ') || 'aucune (statut terminal)'}`,
      );
    }

    invoice.status = target;
    if (mutate) mutate(invoice);
    await this.invoiceRepo.save(invoice);
    return this.findOne(businessId, id);
  }

  private calcTotals(itemsDto: CreateInvoiceDto['items']) {
    let subtotal_ht = 0;
    let tax_amount = 0;

    const items = itemsDto.map((item) => {
      const line_total_ht = this.round(item.quantity * item.unit_price);
      const line_tax = this.round(line_total_ht * (item.tax_rate_value / 100));
      const line_total_ttc = this.round(line_total_ht + line_tax);
      subtotal_ht += line_total_ht;
      tax_amount += line_tax;
      return { ...item, line_total_ht, line_tax, line_total_ttc };
    });

    subtotal_ht = this.round(subtotal_ht);
    tax_amount = this.round(tax_amount);
    const net_amount = this.round(subtotal_ht + tax_amount + 1.000);
    return { subtotal_ht, tax_amount, net_amount, items };
  }

  private async generateNumber(businessId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;

    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING(invoice_number FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM invoices
      WHERE business_id = $1
        AND invoice_number LIKE $2`,
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}
