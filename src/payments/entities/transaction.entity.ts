import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Account }         from './account.entity';
import { Business }        from '../../businesses/entities/business.entity';
import { TransactionType } from '../enums/transaction-type.enum';

@Entity('transactions')
@Index(['business_id', 'transaction_date'])
@Index(['account_id', 'transaction_date'])
@Index(['is_reconciled'])
export class Transaction {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'uuid' })
  account_id: string;

  @ManyToOne(() => Account, (account) => account.transactions)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  amount: number;

  @Column({ type: 'date' })
  transaction_date: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  related_entity_type: string;

  @Column({ type: 'uuid', nullable: true })
  related_entity_id: string;

  @Column({ type: 'boolean', default: false })
  is_reconciled: boolean;

  @Column({ type: 'uuid' })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  // ── Fraud detection fields ──────────────────────────────────────────

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  fraud_score: number | null;

  @Column({ type: 'boolean', default: false })
  is_fraud: boolean;

  @Column({ type: 'boolean', default: false })
  fraud_blocked: boolean;

  @Column({ type: 'boolean', default: false })
  fraud_reviewed: boolean;
}
