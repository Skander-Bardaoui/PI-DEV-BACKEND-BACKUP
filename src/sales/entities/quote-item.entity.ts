import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../stock/entities/product.entity';

@Entity('quote_items')
export class QuoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Quote', 'items', { onDelete: 'CASCADE' })
  quote: any;

  @Column()
  quoteId: string;

  @ManyToOne(() => Product, (product) => product.quoteItems, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: false })
  productId: string;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;
}
