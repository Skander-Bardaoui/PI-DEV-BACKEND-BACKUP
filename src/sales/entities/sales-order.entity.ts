import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Client } from '../entities/client.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { Quote } from './quote.entity';
import { Invoice } from './invoice.entity';
import { DeliveryNote } from './delivery-note.entity';

export enum SalesOrderStatus {
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  DELIVERED = 'DELIVERED',
  INVOICED = 'INVOICED',
  CANCELLED = 'CANCELLED'
}

@Entity('sales_orders')
@Index(['businessId', 'status'])
@Index(['businessId', 'clientId'])
@Index(['businessId', 'expectedDelivery'])
@Index(['quoteId'])
export class SalesOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderNumber: string;

  @Column({ type: 'date' })
  orderDate: Date;

  @Column({ type: 'date', nullable: true })
  deliveryDate: Date;

  @Column({ type: 'date', nullable: true })
  expectedDelivery: Date | null;

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
    enum: SalesOrderStatus,
    default: SalesOrderStatus.CONFIRMED
  })
  status: SalesOrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Link to originating quote
  @Column({ type: 'uuid', nullable: true })
  quoteId: string | null;

  // Link to generated invoice
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfUrl: string | null;

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

  // Relation to originating Quote
  @ManyToOne(() => Quote, (quote) => quote.purchaseOrders, { nullable: true })
  @JoinColumn({ name: 'quoteId' })
  quote: Quote | null;

  // Relation to generated Invoice
  @ManyToOne(() => Invoice, (invoice) => invoice.purchaseOrders, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;

  @OneToMany(() => SalesOrderItem, item => item.salesOrder, { cascade: true })
  items: SalesOrderItem[];

  // Reverse relation to DeliveryNotes
  @OneToMany(() => DeliveryNote, (dn) => dn.salesOrder)
  deliveryNotes: DeliveryNote[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
