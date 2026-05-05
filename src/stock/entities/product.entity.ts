import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { ProductCategory }  from './product-category.entity';
import { StockMovement }    from './stock-movement.entity';
import { SupplierPOItem }   from '../../Purchases/entities/supplier-po-item.entity';
import { GoodsReceiptItem } from '../../Purchases/entities/goods-receipt-item.entity';
import { Business }         from '../../businesses/entities/business.entity';
import { Supplier }         from '../../Purchases/entities/supplier.entity';

export enum ProductType {
  PHYSICAL = 'PHYSICAL',
  SERVICE = 'SERVICE',
  DIGITAL = 'DIGITAL',
}

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

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  min_quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  reserved_quantity: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reserved_supplier_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  default_supplier_id: string | null;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'default_supplier_id' })
  default_supplier: Supplier | null;

  @Column({ type: 'uuid', nullable: true })
  warehouse_id: string | null;

  @ManyToOne('Warehouse', 'products', { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: any;

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

  @Column({ type: 'varchar', length: 20, default: 'PHYSICAL' })
  type: ProductType;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // ==================== Product image ====================
  @Column({ type: 'text', nullable: true })
  image_url: string | null;
  // ======================================================

  // ==================== Audit Fields ====================
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  deleted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne('User', { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  creator: any;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string | null;

  @ManyToOne('User', { nullable: true, eager: false })
  @JoinColumn({ name: 'updated_by' })
  updater: any;

  @Column({ type: 'uuid', nullable: true })
  deleted_by: string | null;

  @ManyToOne('User', { nullable: true, eager: false })
  @JoinColumn({ name: 'deleted_by' })
  deleter: any;

  @Column({ type: 'uuid', nullable: true })
  printed_by: string | null;

  @ManyToOne('User', { nullable: true, eager: false })
  @JoinColumn({ name: 'printed_by' })
  printer: any;

  @Column({ type: 'timestamptz', nullable: true })
  printed_at: Date | null;
  // ======================================================

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory | null;

  @OneToMany(() => StockMovement, (movement) => movement.product)
  stock_movements: StockMovement[];

  @OneToMany('SalesOrderItem', 'product')
  salesOrderItems: any[];

  @OneToMany('QuoteItem', 'product')
  quoteItems: any[];

  @OneToMany('DeliveryNoteItem', 'product')
  deliveryNoteItems: any[];

  @OneToMany('StockExitItem', 'product')
  stockExitItems: any[];

  @OneToMany(() => SupplierPOItem, (item) => item.product)
  supplierPOItems: SupplierPOItem[];

  @OneToMany(() => GoodsReceiptItem, (item) => item.product)
  goodsReceiptItems: GoodsReceiptItem[];
}