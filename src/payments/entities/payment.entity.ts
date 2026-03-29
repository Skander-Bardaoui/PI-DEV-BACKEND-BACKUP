// src/payments/entities/payment.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { PaymentMethod } from '../enums/payment-method.enum';
import { Business }      from '../../businesses/entities/business.entity';
import { Account }       from './account.entity';
 
@Entity('payments')
@Index(['business_id', 'payment_date'])
@Index(['invoice_id'])
@Index(['account_id'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
 
  @Column({ type: 'uuid' })
  business_id!: string;
 
  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business!: Business;
 
  @Column({ type: 'uuid' })
  invoice_id!: string;
 
  // Relation vers Invoice (Module 2 — facturation client)
  @ManyToOne('Invoice', 'payments')
  @JoinColumn({ name: 'invoice_id' })
  invoice!: any;
 
  @Column({ type: 'uuid' })
  account_id!: string;
 
  @ManyToOne(() => Account, (account) => account.payments)
  @JoinColumn({ name: 'account_id' })
  account!: Account;
 
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  amount!: number;
 
  @Column({ type: 'date' })
  payment_date!: Date;
 
  @Column({ type: 'enum', enum: PaymentMethod })
  method!: PaymentMethod;
 
  @Column({ nullable: true })
  reference?: string;
 
  @Column({ type: 'text', nullable: true })
  notes?: string;
 
  @Column({ type: 'uuid' })
  created_by!: string;
 
  @CreateDateColumn()
  created_at!: Date;
}