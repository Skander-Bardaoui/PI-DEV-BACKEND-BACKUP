// src/sales/entities/invoice.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Client } from '../../clients/entities/client.entity';
import { SalesOrder } from './sales-order.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Quote } from './quote.entity';
import { InvoiceType } from '../enums/invoice-type.enum';
import { InvoiceStatus } from '../enums/invoice-status.enum';

// Re-export for backward compatibility
export { InvoiceType, InvoiceStatus };

@Entity('invoices')
@Index(['business_id', 'status'])
@Index(['business_id', 'client_id'])
@Index(['business_id', 'due_date'])
@Index(['purchase_order_id'])
@Index(['quote_id'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoice_number: string;

  @Column({
    type: 'enum',
    enum: InvoiceType,
    default: InvoiceType.NORMAL,
  })
  type: InvoiceType;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid', nullable: true })
  purchase_order_id: string;

  @ManyToOne(() => SalesOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchase_order: SalesOrder;

  @Column({ type: 'uuid', nullable: true })
  quote_id: string | null;

  @ManyToOne(() => Quote, (quote) => quote.invoices, { nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote | null;

  @Column({ type: 'uuid', nullable: true })
  sales_order_id: string;

  @ManyToOne(() => SalesOrder, { nullable: true })
  @JoinColumn({ name: 'sales_order_id' })
  sales_order: SalesOrder;

  @Column({ type: 'uuid', nullable: true })
  original_invoice_id: string;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'original_invoice_id' })
  original_invoice: Invoice;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'date' })
  due_date: Date;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  subtotal_ht: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  timbre_fiscal: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  total_ttc: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  net_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  paid_amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdf_url: string;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  // Reverse relation to Payments
  @OneToMany('Payment', 'invoice')
  payments: any[];

  // Reverse relation to PurchaseOrders
  @OneToMany(() => SalesOrder, (po) => po.invoice)
  purchaseOrders: SalesOrder[];

  // Reverse relation to child invoices (Avoir/Credit Notes)
  @OneToMany(() => Invoice, (invoice) => invoice.original_invoice)
  creditNotes: Invoice[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
