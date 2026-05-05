import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SalaryProposalStatus {
  PENDING   = 'PENDING',
  ACCEPTED  = 'ACCEPTED',
  REJECTED  = 'REJECTED',
  COUNTERED = 'COUNTERED',
  PAID      = 'PAID',
}

@Entity('salary_proposals')
export class SalaryProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  business_id: string;

  @Column()
  user_id: string;

  @Column()
  recipient_email: string;

  @Column()
  recipient_name: string;

  @Column()
  sender_name: string;

  @Column({ nullable: true })
  sender_email: string;

  @Column()
  business_name: string;

  @Column('decimal', { precision: 12, scale: 2 })
  proposed_amount: number;

  @Column({ nullable: true, type: 'decimal', precision: 12, scale: 2 })
  counter_amount: number | null;

  @Column({ default: 'TND' })
  currency: string;

  @Column({ nullable: true, type: 'text' })
  message: string | null;

  @Column({ nullable: true, type: 'text' })
  response_note: string | null;

  @Column({
    type: 'enum',
    enum: SalaryProposalStatus,
    default: SalaryProposalStatus.PENDING,
  })
  status: SalaryProposalStatus;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'timestamp', nullable: true })
  responded_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  account_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  transaction_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
