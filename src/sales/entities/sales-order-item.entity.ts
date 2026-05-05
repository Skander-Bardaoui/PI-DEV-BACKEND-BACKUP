import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../stock/entities/product.entity';

@Entity('sales_order_items')
export class SalesOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('SalesOrder', 'items', { onDelete: 'CASCADE' })
  salesOrder: any;

  @Column()
  salesOrderId: string;

  @ManyToOne(() => Product, (product) => product.salesOrderItems, { nullable: false })
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
