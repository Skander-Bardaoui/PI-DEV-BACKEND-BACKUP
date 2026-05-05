// src/platform-admin/entities/support-ticket.entity.ts
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
import { User } from '../../users/entities/user.entity';
import { PlatformAdmin } from '../../platform-auth/entities/platform-admin.entity';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tenant_id!: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column()
  submitted_by_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by_id' })
  submitted_by!: User;

  @Column()
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority!: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status!: TicketStatus;

  @Column({ nullable: true })
  assigned_to_id?: string;

  @ManyToOne(() => PlatformAdmin, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assigned_to?: PlatformAdmin;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
