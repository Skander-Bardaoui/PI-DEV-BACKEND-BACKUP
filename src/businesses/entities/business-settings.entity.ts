// src/businesses/entities/business-settings.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';

@Entity('business_settings')
export class BusinessSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  business_id: string;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tax_rate: number; // Override for invoice-specific tax rate

  @Column({ nullable: true })
  invoice_prefix: string; // e.g., "INV-2026-"

  @Column({ type: 'int', nullable: true })
  payment_terms: number; // Default payment terms in days (e.g., 30)

  @Column({ type: 'json', nullable: true })
  invoice_template: object; // Custom invoice template config

  @Column({ type: 'json', nullable: true })
  other_settings: object; // Flexible key-value store
}