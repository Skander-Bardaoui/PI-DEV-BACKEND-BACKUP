// src/businesses/entities/business.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ nullable: true })
  logo: string;

  // Matricule Fiscal tunisien
  @Column({ nullable: true })
  tax_id: string;

  // FIX : champs ajoutés pour le portail fournisseur et les emails
  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'TND' })
  currency: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tax_rate: number;

  @Column({ type: 'json', nullable: true })
  address: object;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}