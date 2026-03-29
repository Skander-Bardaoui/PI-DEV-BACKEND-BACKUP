import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { ProductCategory }  from './product-category.entity';
import { StockMovement }    from './stock-movement.entity';
import { SupplierPOItem }   from 'src/Purchases/entities/supplier-po-item.entity';
import { GoodsReceiptItem } from 'src/Purchases/entities/goods-receipt-item.entity';
import { Business }         from 'src/businesses/entities/business.entity';
import { Supplier }         from 'src/Purchases/entities/supplier.entity';
 
@Entity('products')
@Index(['business_id', 'is_active'])
@Index(['business_id', 'sku'])
@Index(['category_id'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ type: 'uuid' })
  @Index()
  business_id: string;
 
  // FIX : relation FK vers Business
  @ManyToOne(() => Business, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;
 
  @Column({ type: 'varchar', length: 255 })
  name: string;
 
  @Column({ type: 'varchar', length: 100 })
  @Index()
  sku: string;
 
  @Column({ type: 'text', nullable: true })
  description: string | null;
 
  @Column({ type: 'decimal', precision: 12, scale: 3 })
  price: number;
 
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  cost: number | null;
 
  // FIX : decimal au lieu de int — cohérent avec StockMovement.quantity (decimal 15,3)
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity: number;
 
  // FIX : snake_case
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  min_quantity: number;
 
  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;
 
  @Column({ type: 'uuid', nullable: true })
  default_supplier_id: string | null;
 
  // FIX : relation ManyToOne vers Supplier (manquait)
  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'default_supplier_id' })
  default_supplier: Supplier | null;
 
  @Column({ type: 'varchar', length: 20, default: 'pcs' })
  unit: string;
 
  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode: string | null;
 
  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  weight: number | null;
 
  @Column({ type: 'jsonb', nullable: true })
  dimensions: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  } | null;
 
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19 })
  tax_rate: number;
 
  @Column({ type: 'boolean', default: true })
  track_inventory: boolean;
 
  @Column({ type: 'varchar', length: 20, default: 'product' })
  type: string;
 
  // FIX : snake_case
  @Column({ type: 'boolean', default: true })
  is_active: boolean;
 
  // FIX : snake_case
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
 
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
 
  // Relations
  @ManyToOne(() => ProductCategory, (category) => category.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory | null;
 
  @OneToMany(() => StockMovement, (movement) => movement.product)
  stock_movements: StockMovement[];
 
  // Relations inter-modules (string pour éviter les imports circulaires)
  // Sales module relations
  @OneToMany('SalesOrderItem', 'product')
  salesOrderItems: any[];

  @OneToMany('QuoteItem', 'product')
  quoteItems: any[];

  @OneToMany('DeliveryNoteItem', 'product')
  deliveryNoteItems: any[];

  @OneToMany('StockExitItem', 'product')
  stockExitItems: any[];
 
  // Relations Purchases — imports directs OK (pas de circulaire)
  @OneToMany(() => SupplierPOItem, (item) => item.product)
  supplierPOItems: SupplierPOItem[];
 
  @OneToMany(() => GoodsReceiptItem, (item) => item.product)
  goodsReceiptItems: GoodsReceiptItem[];
}
 
 