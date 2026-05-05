// src/sales/entities/invoice-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { TaxRate } from '../../businesses/entities/tax-rate.entity';
import { Product } from '../../stock/entities/product.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'uuid', nullable: true })
  productId: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  unit_price: number;

  @Column({ type: 'uuid', nullable: true })
  tax_rate_id: string;

  @ManyToOne(() => TaxRate, { nullable: true })
  @JoinColumn({ name: 'tax_rate_id' })
  tax_rate: TaxRate;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tax_rate_value: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  line_total_ht: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  line_tax: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  line_total_ttc: number;

  @Column({ type: 'int', default: 0 })
  sort_order: number;
}
