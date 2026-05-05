// src/platform-admin/entities/platform-audit-log.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PlatformAdmin } from '../../platform-auth/entities/platform-admin.entity';

@Entity('platform_audit_logs')
export class PlatformAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  admin_id!: string;

  @ManyToOne(() => PlatformAdmin)
  @JoinColumn({ name: 'admin_id' })
  admin!: PlatformAdmin;

  @Column()
  action!: string; // e.g. 'tenant.approved', 'tenant.suspended', 'subscription.updated', 'admin.login', 'impersonation.started'

  @Column({ nullable: true })
  target_type?: string; // e.g. 'tenant', 'subscription'

  @Column({ type: 'uuid', nullable: true })
  target_id?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column()
  ip_address!: string;

  @CreateDateColumn()
  created_at!: Date;
}
