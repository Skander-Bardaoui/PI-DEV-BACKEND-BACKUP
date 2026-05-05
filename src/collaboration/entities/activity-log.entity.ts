import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Task } from './task.entity';

export enum ActivityLogEntityType {
  TASK = 'TASK',
  COMMENT = 'COMMENT',
  TEAM_MEMBER = 'TEAM_MEMBER',
  QUOTE = 'QUOTE',
  SALES_ORDER = 'SALES_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  SUPPLIER_PO = 'SUPPLIER_PO',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  SUPPLIER_PAYMENT = 'SUPPLIER_PAYMENT',
  CLIENT = 'CLIENT',
  PRODUCT = 'PRODUCT',
  STOCK_MOVEMENT = 'STOCK_MOVEMENT',
  BUSINESS = 'BUSINESS',
  USER = 'USER',
}

export enum ActivityLogAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ASSIGN = 'ASSIGN',
  UNASSIGN = 'UNASSIGN',
  COMPLETE = 'COMPLETE',
  REOPEN = 'REOPEN',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SEND = 'SEND',
  RECEIVE = 'RECEIVE',
  CANCEL = 'CANCEL',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
  COMMENT = 'COMMENT',
  SHARE = 'SHARE',
  DOWNLOAD = 'DOWNLOAD',
  UPLOAD = 'UPLOAD',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

@Entity('activity_logs')
@Index(['tenantId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['entityType', 'entityId'])
@Index(['businessId', 'createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec User (qui a effectué l'action)
  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Relations avec Tenant
  @Column('uuid')
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Relations avec Business (optionnel)
  @Column('uuid', { nullable: true })
  businessId: string | null;

  @ManyToOne(() => Business, { nullable: true })
  @JoinColumn({ name: 'businessId' })
  business: Business | null;

  @Column({
    type: 'enum',
    enum: ActivityLogEntityType,
  })
  entityType: ActivityLogEntityType;

  @Column('uuid')
  @Index()
  entityId: string;

  // Note: We use a polymorphic relationship approach
  // The actual entity is determined by entityType and entityId
  // No direct foreign key relationships to avoid conflicts

  @Column({
    type: 'enum',
    enum: ActivityLogAction,
  })
  action: ActivityLogAction;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValue: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValue: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column('varchar', { nullable: true })
  ipAddress: string | null;

  @Column('varchar', { nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
