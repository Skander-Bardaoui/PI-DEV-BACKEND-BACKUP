import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Client } from '../entities/client.entity';
import { QuoteItem } from './quote-item.entity';
import { SalesOrder } from './sales-order.entity';
import { Invoice } from './invoice.entity';

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED'
}

@Entity('quotes')
@Index(['businessId', 'status'])
@Index(['businessId', 'clientId'])
@Index(['businessId', 'validUntil'])
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quoteNumber: string;

  @Column({ type: 'date' })
  quoteDate: Date;

  @Column({ type: 'date', nullable: true, name: 'valid_until' })
  validUntil: Date;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  total: number;

  // Timbre fiscal tunisien - 1.000 DT fixe
  @Column({ type: 'decimal', precision: 12, scale: 3, default: 1.000 })
  timbreFiscal: number;

  // NET À PAYER = total + timbreFiscal
  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  netAmount: number;

  @Column({
    type: 'enum',
    enum: QuoteStatus,
    default: QuoteStatus.DRAFT
  })
  status: QuoteStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Conversion tracking
  @Column({ type: 'uuid', nullable: true, name: 'converted_to_po_id' })
  convertedToPoId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'converted_to_invoice_id' })
  convertedToInvoiceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'accepted_at' })
  acceptedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'rejected_at' })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string | null;

  @ManyToOne(() => Business, { nullable: false })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: string;

  @OneToMany(() => QuoteItem, item => item.quote, { cascade: true })
  items: QuoteItem[];

  // Conversion relations
  @ManyToOne(() => SalesOrder, { nullable: true })
  @JoinColumn({ name: 'convertedToPoId' })
  convertedToPurchaseOrder: SalesOrder | null;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'convertedToInvoiceId' })
  convertedToInvoice: Invoice | null;

  // Reverse relations
  @OneToMany(() => SalesOrder, (po) => po.quote)
  purchaseOrders: SalesOrder[];

  @OneToMany(() => Invoice, (invoice) => invoice.quote)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
