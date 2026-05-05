// src/platform-admin/entities/subscription.entity.ts
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
import { Plan } from './plan.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tenant_id!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column()
  plan_id!: string;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan!: Plan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIAL,
  })
  status!: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billing_cycle!: BillingCycle;

  @Column({ type: 'timestamp' })
  current_period_start!: Date;

  @Column({ type: 'timestamp' })
  current_period_end!: Date;

  @Column({ type: 'timestamp', nullable: true })
  trial_ends_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  suspended_at?: Date;

  @Column({ nullable: true })
  payment_method?: string;

  @Column({ type: 'timestamp', nullable: true })
  last_payment_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  next_billing_at?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', unique: true, nullable: true })
  payment_token?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
