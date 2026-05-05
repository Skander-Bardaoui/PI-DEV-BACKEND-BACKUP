// src/platform-admin/entities/tenant-approval.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PlatformAdmin } from '../../platform-auth/entities/platform-admin.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';

@Entity('tenant_approvals')
export class TenantApproval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tenant_id!: string;

  @OneToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status!: ApprovalStatus;

  @Column({ nullable: true })
  reviewed_by_id?: string;

  @ManyToOne(() => PlatformAdmin, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewed_by?: PlatformAdmin;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at?: Date;

  @Column({ type: 'text', nullable: true })
  rejection_reason?: string;

  @CreateDateColumn()
  created_at!: Date;
}
