import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { RecurringInvoice, RecurringInvoiceStatus, DiscountType } from '../entities/recurring-invoice.entity';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import { RecurringInvoicesService } from './recurring-invoices.service';
// import { RecurringSubscriptionMailService } from './recurring-subscription-mail.service';
import { DataSource } from 'typeorm';

@Injectable()
export class RecurringInvoiceCronService {
  private readonly logger = new Logger(RecurringInvoiceCronService.name);

  constructor(
    @InjectRepository(RecurringInvoice)
    private readonly recurringRepo: Repository<RecurringInvoice>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepo: Repository<InvoiceItem>,
    private readonly recurringService: RecurringInvoicesService,
    // private readonly subscriptionMailService: RecurringSubscriptionMailService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateRecurringInvoices() {
    this.logger.log('Starting recurring invoice generation...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueRecurring = await this.recurringRepo.find({
      where: {
        status: RecurringInvoiceStatus.ACTIVE,
        next_invoice_date: LessThanOrEqual(today),
      },
      relations: ['client', 'business'],
    });

    this.logger.log(`Found ${dueRecurring.length} recurring invoices to generate`);

    for (const recurring of dueRecurring) {
      try {
        // Check if end_date has passed
        if (recurring.end_date && new Date(recurring.end_date) < today) {
          recurring.status = RecurringInvoiceStatus.INACTIVE;
          await this.recurringRepo.save(recurring);
          this.logger.log(`Deactivated recurring invoice ${recurring.id} - end date reached`);
          continue;
        }

        await this.dataSource.transaction(async (manager) => {
          // Generate invoice number
          const invoiceNumber = await this.generateInvoiceNumber(recurring.business_id, manager);

          // Apply discount
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

          // Log discount application
          if (recurring.discount_type && recurring.discount_value) {
            this.logger.log(
              `Applied ${recurring.discount_type} discount of ${recurring.discount_value} to recurring ${recurring.id}. Base: ${baseAmount}, After discount: ${subtotal_ht}`
            );
          }

          // Create invoice
          const invoice = manager.create(Invoice, {
            business_id: recurring.business_id,
            client_id: recurring.client_id,
            recurring_invoice_id: recurring.id,
            invoice_number: invoiceNumber,
            type: 'NORMAL' as any,
            date: today,
            due_date: this.calculateDueDate(today, 30),
            status: InvoiceStatus.DRAFT,
            subtotal_ht,
            tax_amount,
            timbre_fiscal,
            total_ttc,
            net_amount,
            paid_amount: 0,
            notes: `Facture récurrente - ${recurring.description}`,
          });

          const savedInvoice = await manager.save(Invoice, invoice);

          // Create invoice item
          const lineTotal = subtotal_ht;
          const lineTax = tax_amount;
          const lineTotalTtc = lineTotal + lineTax;

          const invoiceItem = manager.create(InvoiceItem, {
            invoice_id: savedInvoice.id,
            description: recurring.description,
            quantity: 1,
            unit_price: subtotal_ht,
            tax_rate_value: recurring.tax_rate,
            line_total_ht: lineTotal,
            line_tax: lineTax,
            line_total_ttc: lineTotalTtc,
            sort_order: 0,
          });

          await manager.save(InvoiceItem, invoiceItem);

          // Update recurring invoice
          recurring.last_generated_date = today;
          recurring.next_invoice_date = this.recurringService.calculateNextDate(
            today,
            recurring.frequency,
          );
          recurring.invoices_generated += 1;
          await manager.save(RecurringInvoice, recurring);

          this.logger.log(
            `Generated invoice ${invoiceNumber} from recurring ${recurring.id}`,
          );

          // Send email to client with subscription management options
          // TODO: Uncomment when RecurringSubscriptionMailService is ready
          /*
          try {
            await this.subscriptionMailService.sendRecurringInvoiceEmail(
              recurring,
              savedInvoice,
            );
            this.logger.log(`Sent subscription email for invoice ${invoiceNumber}`);
          } catch (emailError) {
            this.logger.error(
              `Failed to send subscription email for invoice ${invoiceNumber}:`,
              emailError,
            );
          }
          */
        });
      } catch (error) {
        this.logger.error(
          `Failed to generate invoice for recurring ${recurring.id}:`,
          error,
        );
      }
    }

    this.logger.log('Recurring invoice generation completed');
  }

  private applyDiscount(amount: number, type: DiscountType | null, value: number | null): number {
    if (!type || value == null) return amount;
    if (type === DiscountType.PERCENTAGE) return amount * (1 - value / 100);
    if (type === DiscountType.FIXED) return Math.max(0, amount - value);
    return amount;
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

  private calculateDueDate(date: Date, days: number): Date {
    const due = new Date(date);
    due.setDate(due.getDate() + days);
    return due;
  }
}
