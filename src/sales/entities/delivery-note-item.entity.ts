import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../stock/entities/product.entity';

@Entity('delivery_note_items')
export class DeliveryNoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('DeliveryNote', 'items', { onDelete: 'CASCADE' })
  deliveryNote: any;

  @Column()
  deliveryNoteId: string;

  @ManyToOne(() => Product, (product) => product.deliveryNoteItems, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ nullable: true })
  productId: string;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveredQuantity: number;
}
