// src/payments/entities/payment-schedule.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { PurchaseInvoice }            from '../../Purchases/entities/purchase-invoice.entity';
import { PaymentScheduleInstallment } from './payment-schedule-installment';

export enum ScheduleStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE           = 'ACTIVE',
  REJECTED         = 'REJECTED',
}

@Entity('payment_schedules')
export class PaymentSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'uuid' })
  purchase_invoice_id: string;

  @ManyToOne(() => PurchaseInvoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_invoice_id' })
  purchase_invoice: PurchaseInvoice;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  total_amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  // ── NEW ──────────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ScheduleStatus,
    default: ScheduleStatus.PENDING_APPROVAL,
  })
  status: ScheduleStatus;

  /** Secure token emailed to supplier for accept / reject */
  @Column({ type: 'uuid', unique: true, nullable: true })
  supplier_token: string | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;
  // ─────────────────────────────────────────────────────────────────

  @OneToMany(
    () => PaymentScheduleInstallment,
    (i) => i.schedule,
    { cascade: true, eager: true },
  )
  installments: PaymentScheduleInstallment[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
