// src/businesses/entities/tax-rate.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';

@Entity('tax_rates')
export class TaxRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column()
  name: string; // e.g., "TVA Standard", "TVA Réduite", "Exonéré"

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  rate: number; // e.g., 19.00, 7.00, 0.00

  @Column({ default: false })
  is_default: boolean; // If true, this rate is auto-selected for new invoices

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}