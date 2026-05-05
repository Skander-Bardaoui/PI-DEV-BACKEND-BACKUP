import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Product } from '../../stock/entities/product.entity';
import { SupplierPO } from './supplier-po.entity';

export enum MLRecommendationActionType {
  BC_CREATED = 'BC_CREATED',
  DISMISSED = 'DISMISSED',
  IGNORED = 'IGNORED',
}

@Entity('ml_recommendation_actions')
export class MLRecommendationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'date' })
  recommendation_date: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: MLRecommendationActionType,
  })
  action_type: MLRecommendationActionType;

  @Column({ type: 'uuid', nullable: true })
  supplier_po_id?: string;

  @ManyToOne(() => SupplierPO, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_po_id' })
  supplier_po?: SupplierPO;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}