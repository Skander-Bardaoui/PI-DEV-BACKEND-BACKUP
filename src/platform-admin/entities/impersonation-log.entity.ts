// src/platform-admin/entities/impersonation-log.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PlatformAdmin } from '../../platform-auth/entities/platform-admin.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('impersonation_logs')
export class ImpersonationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  admin_id!: string;

  @ManyToOne(() => PlatformAdmin)
  @JoinColumn({ name: 'admin_id' })
  admin!: PlatformAdmin;

  @Column()
  tenant_id!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column()
  ip_address!: string;

  @Column({ nullable: true })
  user_agent?: string;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
