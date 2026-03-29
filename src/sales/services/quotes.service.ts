import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Quote } from '../entities/quote.entity';
import { QuoteItem } from '../entities/quote-item.entity';
import { QuoteStatus } from '../entities/quote.entity';
import { SalesOrder, SalesOrderStatus } from '../entities/sales-order.entity';
import { SalesOrderItem } from '../entities/sales-order-item.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { UpdateQuoteDto } from '../dto/update-quote.dto';

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.SENT],
  [QuoteStatus.SENT]: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
  [QuoteStatus.ACCEPTED]: [QuoteStatus.CONVERTED],
  [QuoteStatus.REJECTED]: [],
  [QuoteStatus.EXPIRED]: [],
  [QuoteStatus.CONVERTED]: [],
};

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    @InjectRepository(QuoteItem)
    private readonly itemRepo: Repository<QuoteItem>,

    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,

    @InjectRepository(SalesOrderItem)
    private readonly salesOrderItemRepo: Repository<SalesOrderItem>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,

    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, dto: CreateQuoteDto): Promise<Quote> {
    return this.dataSource.transaction(async (manager) => {
      const quoteNumber = await this.generateNumber(businessId, manager);
      const { items: itemsDto, ...rest } = dto;
      const { subtotal, taxAmount, netAmount, items } = this.calcTotals(itemsDto);

      const quote = manager.create(Quote, {
        ...rest,
        quoteNumber,
        businessId,
        status: QuoteStatus.DRAFT,
        subtotal,
        taxAmount,
        total: subtotal + taxAmount,
        timbreFiscal: 1.000,
        netAmount,
        quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      });
      const saved = await manager.save(Quote, quote);

      const lines = items.map((item, i) =>
        manager.create(QuoteItem, {
          ...item,
          quoteId: saved.id,
        }),
      );
      await manager.save(QuoteItem, lines);

      return manager.findOne(Quote, {
        where: { id: saved.id },
        relations: ['items', 'client'],
      }) as Promise<Quote>;
    });
  }

  async findAll(businessId: string, query: any) {
    const { client_id, status, page = 1, limit = 20 } = query;

    const qb = this.quoteRepo
      .createQueryBuilder('quote')
      .leftJoinAndSelect('quote.client', 'client')
      .where('quote.businessId = :businessId', { businessId })
      .orderBy('quote.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim());
      qb.andWhere('quote.status IN (:...statuses)', { statuses });
    }
    if (client_id) qb.andWhere('quote.clientId = :client_id', { client_id });

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);
    return { data, total, page, limit, total_pages };
  }

  async findOne(businessId: string, id: string): Promise<Quote> {
    const quote = await this.quoteRepo.findOne({
      where: { id, businessId },
      relations: ['items', 'client'],
    });
    if (!quote) throw new NotFoundException(`Devis introuvable (id: ${id})`);
    return quote;
  }

  async update(businessId: string, id: string, dto: UpdateQuoteDto): Promise<Quote> {
    const quote = await this.findOne(businessId, id);

    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        `Modification impossible. Statut actuel : ${quote.status}. Requis : DRAFT.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Update basic fields
      if (dto.clientId !== undefined) quote.clientId = dto.clientId;
      if (dto.quoteDate !== undefined) {
        quote.quoteDate = dto.quoteDate ? new Date(dto.quoteDate) : new Date();
      }
      if (dto.validUntil !== undefined) {
        quote.validUntil = dto.validUntil ? new Date(dto.validUntil) : undefined as any;
      }
      if (dto.notes !== undefined) quote.notes = dto.notes;

      if (dto.items?.length) {
        await manager.delete(QuoteItem, { quoteId: id });

        const { subtotal, taxAmount, netAmount, items } = this.calcTotals(dto.items);
        quote.subtotal = subtotal;
        quote.taxAmount = taxAmount;
        quote.total = subtotal + taxAmount;
        quote.netAmount = netAmount;

        await manager.save(Quote, quote);

        const lines = items.map((item) =>
          manager.create(QuoteItem, {
            ...item,
            quoteId: id,
          }),
        );
        await manager.save(QuoteItem, lines);
      } else {
        await manager.save(Quote, quote);
      }

      return manager.findOne(Quote, {
        where: { id },
        relations: ['items', 'client'],
      }) as Promise<Quote>;
    });
  }

  async send(businessId: string, id: string) {
    return this.transition(businessId, id, QuoteStatus.SENT, (q) => {
      q.sentAt = new Date();
    });
  }

  async accept(businessId: string, id: string) {
    return this.transition(businessId, id, QuoteStatus.ACCEPTED);
  }

  async reject(businessId: string, id: string) {
    return this.transition(businessId, id, QuoteStatus.REJECTED);
  }

  async expire(businessId: string, id: string) {
    return this.transition(businessId, id, QuoteStatus.EXPIRED);
  }

  async convert(businessId: string, id: string) {
    return this.transition(businessId, id, QuoteStatus.CONVERTED);
  }

  private async transition(
    businessId: string,
    id: string,
    target: QuoteStatus,
    mutate?: (quote: Quote) => void,
  ): Promise<Quote> {
    const quote = await this.findOne(businessId, id);
    const allowed = TRANSITIONS[quote.status];

    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Transition invalide : ${quote.status} → ${target}. ` +
        `Autorisées : ${allowed.join(', ') || 'aucune (statut terminal)'}`,
      );
    }

    quote.status = target;
    if (mutate) mutate(quote);
    await this.quoteRepo.save(quote);
    return this.findOne(businessId, id);
  }

  private calcTotals(itemsDto: CreateQuoteDto['items']) {
    let subtotal = 0;
    let taxAmount = 0;

    const items = itemsDto.map((item) => {
      const total = this.round(item.quantity * item.unitPrice);
      const itemTax = this.round(total * (item.taxRate / 100));
      subtotal += total;
      taxAmount += itemTax;
      return { ...item, total };
    });

    subtotal = this.round(subtotal);
    taxAmount = this.round(taxAmount);
    const netAmount = this.round(subtotal + taxAmount + 1.000);
    return { subtotal, taxAmount, netAmount, items };
  }

  private async generateNumber(businessId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEV-${year}-`;

    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING("quoteNumber" FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM quotes
      WHERE "businessId" = $1
        AND "quoteNumber" LIKE $2`,
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }

  async delete(businessId: string, id: string): Promise<void> {
    const quote = await this.findOne(businessId, id);
    
    // Allow deletion of DRAFT and CONVERTED quotes
    // CONVERTED quotes can be deleted because the invoice/order already exists
    if (quote.status !== QuoteStatus.DRAFT && quote.status !== QuoteStatus.CONVERTED) {
      throw new BadRequestException(
        `Suppression impossible. Seuls les devis en brouillon (DRAFT) ou convertis (CONVERTED) peuvent être supprimés. Statut actuel : ${quote.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // For CONVERTED quotes, we need to remove the foreign key references first
      if (quote.status === QuoteStatus.CONVERTED) {
        // Update invoices that reference this quote
        await manager.query(
          `UPDATE invoices SET quote_id = NULL WHERE quote_id = $1`,
          [id]
        );

        // Update sales orders that reference this quote
        await manager.query(
          `UPDATE sales_orders SET "quoteId" = NULL WHERE "quoteId" = $1`,
          [id]
        );
      }

      // Delete quote items first
      await manager.delete(QuoteItem, { quoteId: id });
      
      // Then delete the quote
      await manager.delete(Quote, { id, businessId });
    });
  }

  async convertToInvoice(businessId: string, id: string): Promise<Invoice> {
    const quote = await this.findOne(businessId, id);

    console.log('Converting quote to invoice:', { quoteId: id, status: quote.status });

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException(
        `Le devis doit être accepté avant conversion. Statut actuel : ${quote.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      try {
        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(businessId, manager);
        console.log('Generated invoice number:', invoiceNumber);

        // Create invoice
        const invoice = manager.create(Invoice, {
          business_id: businessId,
          client_id: quote.clientId,
          invoice_number: invoiceNumber,
          type: 'NORMAL' as any,
          status: InvoiceStatus.DRAFT,
          date: new Date(),
          due_date: this.calculateDueDate(new Date(), 30),
          quote_id: quote.id,
          subtotal_ht: Number(quote.subtotal),
          tax_amount: Number(quote.taxAmount),
          timbre_fiscal: Number(quote.timbreFiscal),
          total_ttc: Number(quote.total) + Number(quote.timbreFiscal),
          net_amount: Number(quote.netAmount),
          paid_amount: 0,
          notes: quote.notes,
        });

        console.log('Created invoice entity');
        const savedInvoice = await manager.save(Invoice, invoice);
        console.log('Saved invoice:', savedInvoice.id);

        // Create invoice items
        const invoiceItems = quote.items.map((item) => {
          const lineTotal = Number(item.quantity) * Number(item.unitPrice);
          const lineTax = lineTotal * (Number(item.taxRate) / 100);
          const lineTotalTtc = lineTotal + lineTax;
          
          return manager.create(InvoiceItem, {
            invoice_id: savedInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            tax_rate_value: item.taxRate,
            line_total_ht: lineTotal,
            line_tax: lineTax,
            line_total_ttc: lineTotalTtc,
            sort_order: 0,
          });
        });

        await manager.save(InvoiceItem, invoiceItems);
        console.log('Saved invoice items:', invoiceItems.length);

        // Update quote
        quote.status = QuoteStatus.CONVERTED;
        quote.convertedToInvoiceId = savedInvoice.id;
        await manager.save(Quote, quote);
        console.log('Updated quote status to CONVERTED');

        return manager.findOne(Invoice, {
          where: { id: savedInvoice.id },
          relations: ['items', 'client'],
        }) as Promise<Invoice>;
      } catch (error) {
        console.error('Error in convertToInvoice transaction:', error);
        throw error;
      }
    });
  }

  async convertToOrder(businessId: string, id: string): Promise<SalesOrder> {
    const quote = await this.findOne(businessId, id);

    console.log('Converting quote to order:', { quoteId: id, status: quote.status });

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException(
        `Le devis doit être accepté avant conversion. Statut actuel : ${quote.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      try {
        // Generate order number
        const orderNumber = await this.generateOrderNumber(businessId, manager);
        console.log('Generated order number:', orderNumber);

        // Create sales order
        const order = manager.create(SalesOrder, {
          businessId: businessId,
          clientId: quote.clientId,
          orderNumber: orderNumber,
          status: SalesOrderStatus.CONFIRMED,
          orderDate: new Date(),
          expectedDelivery: this.calculateDueDate(new Date(), 7),
          quoteId: quote.id,
          subtotal: Number(quote.subtotal),
          taxAmount: Number(quote.taxAmount),
          total: Number(quote.total),
          timbreFiscal: Number(quote.timbreFiscal),
          netAmount: Number(quote.netAmount),
          notes: quote.notes,
        });

        console.log('Created order entity');
        const savedOrder = await manager.save(SalesOrder, order);
        console.log('Saved order:', savedOrder.id);

        // Create order items
        const orderItems = quote.items.map((item) => {
          const total = Number(item.quantity) * Number(item.unitPrice);
          
          return manager.create(SalesOrderItem, {
            salesOrderId: savedOrder.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: total,
          });
        });

        await manager.save(SalesOrderItem, orderItems);
        console.log('Saved order items:', orderItems.length);

        // Update quote
        quote.status = QuoteStatus.CONVERTED;
        quote.convertedToPoId = savedOrder.id;
        await manager.save(Quote, quote);
        console.log('Updated quote status to CONVERTED');

        return manager.findOne(SalesOrder, {
          where: { id: savedOrder.id },
          relations: ['items', 'client'],
        }) as Promise<SalesOrder>;
      } catch (error) {
        console.error('Error in convertToOrder transaction:', error);
        throw error;
      }
    });
  }

  private async generateInvoiceNumber(businessId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

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

    const seq = String(result[0]?.next_seq ?? 1).padStart(5, '0');
    return `${prefix}${seq}`;
  }

  private async generateOrderNumber(businessId: string, manager: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BC-${year}-`;

    const result = await manager.query(
      `SELECT COALESCE(
        MAX(CAST(SUBSTRING("orderNumber" FROM ${prefix.length + 1}) AS INTEGER)),
        0
      ) + 1 AS next_seq
      FROM sales_orders
      WHERE "businessId" = $1
        AND "orderNumber" LIKE $2`,
      [businessId, `${prefix}%`],
    );

    const seq = String(result[0]?.next_seq ?? 1).padStart(5, '0');
    return `${prefix}${seq}`;
  }

  private calculateDueDate(date: Date, days: number): Date {
    const due = new Date(date);
    due.setDate(due.getDate() + days);
    return due;
  }
}
