// src/sales/entities/recurring-subscription-token.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RecurringInvoice } from './recurring-invoice.entity';
import { Invoice } from './invoice.entity';

@Entity('recurring_subscription_tokens')
export class RecurringSubscriptionToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  token: string;

  @Column({ type: 'uuid' })
  recurring_invoice_id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  action: string; // 'continue' or 'cancel'

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => RecurringInvoice)
  @JoinColumn({ name: 'recurring_invoice_id' })
  recurringInvoice: RecurringInvoice;

  @ManyToOne(() => Invoice)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
