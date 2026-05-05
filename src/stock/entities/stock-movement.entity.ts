import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { StockMovementType } from '../enums/stock-movement-type.enum';
import { Product }   from './product.entity';
import { Business }  from '../../businesses/entities/business.entity';
 
@Entity('stock_movements')
// FIX : snake_case dans les index
@Index(['product_id', 'created_at'])
@Index(['business_id', 'type'])
@Index(['reference_type', 'reference_id'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ type: 'uuid' })
  @Index()
  business_id: string;
 
  // FIX : relation FK vers Business
  @ManyToOne(() => Business, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;
 
  // FIX : snake_case + syntaxe complète
  @Column({ type: 'uuid' })
  @Index()
  product_id: string;
 
  @Column({ type: 'enum', enum: StockMovementType })
  type: StockMovementType;
 
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;
 
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity_before: number;
 
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity_after: number;
 
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  unit_cost: number | null;
 
  @Column({ type: 'decimal', precision: 15, scale: 3, nullable: true })
  total_value: number | null;
 
  @Column({ type: 'varchar', length: 50, nullable: true })
  reference_type: string | null;
 
  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;
 
  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;
 
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;
 
  @Column({ type: 'text', nullable: true })
  note: string | null;
 
  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ type: 'uuid', nullable: true })
  warehouse_id: string | null;

  @ManyToOne('Warehouse', 'stock_movements', { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: any;
 
  // ==================== Audit Fields ====================
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  deleted_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deleted_by: string | null;

  @ManyToOne('User', { nullable: true, eager: false })
  @JoinColumn({ name: 'deleted_by' })
  deleter: any;
  // ======================================================
 
  @ManyToOne(() => Product, (product) => product.stock_movements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}