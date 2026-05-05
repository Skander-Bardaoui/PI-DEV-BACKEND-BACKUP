import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { PaymentMethod }   from '../enums/payment-method.enum';
import { Account }         from './account.entity';
import { PaymentSchedule } from './payment-schedule';
import { InstallmentStatus } from '../enums/installment-status';

@Entity('payment_schedule_installments')
export class PaymentScheduleInstallment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  schedule_id: string;

  @ManyToOne(() => PaymentSchedule, (s) => s.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: PaymentSchedule;

  @Column({ type: 'int' })
  installment_number: number;          // 1, 2, 3 …

  @Column({ type: 'date' })
  due_date: Date;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  amount: number;

  @Column({
    type: 'enum',
    enum: InstallmentStatus,
    default: InstallmentStatus.PENDING,
  })
  status: InstallmentStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.VIREMENT })
  payment_method: PaymentMethod;

  /** Filled when marked PAID */
  @Column({ type: 'uuid', nullable: true })
  account_id: string | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'account_id' })
  account: Account | null;

  @Column({ type: 'date', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Linked SupplierPayment created on payment */
  @Column({ type: 'uuid', nullable: true })
  supplier_payment_id: string | null;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
