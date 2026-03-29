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

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  MENTION = 'MENTION',
  COMMENT_ADDED = 'COMMENT_ADDED',
  COMMENT_REPLY = 'COMMENT_REPLY',
  DOCUMENT_SHARED = 'DOCUMENT_SHARED',
  DOCUMENT_APPROVED = 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED = 'DOCUMENT_REJECTED',
  INVOICE_OVERDUE = 'INVOICE_OVERDUE',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',
  CLIENT_PORTAL_ACCESS = 'CLIENT_PORTAL_ACCESS',
  TEAM_MEMBER_ADDED = 'TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED = 'TEAM_MEMBER_REMOVED',
  SYSTEM = 'SYSTEM',
}

export enum NotificationEntityType {
  TASK = 'TASK',
  COMMENT = 'COMMENT',
  QUOTE = 'QUOTE',
  SALES_ORDER = 'SALES_ORDER',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  SUPPLIER_PO = 'SUPPLIER_PO',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  CLIENT = 'CLIENT',
  TEAM_MEMBER = 'TEAM_MEMBER',
  DOCUMENT = 'DOCUMENT',
}

@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec User (destinataire)
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

  // Utilisateur qui a déclenché la notification (optionnel)
  @Column('uuid', { nullable: true })
  triggeredById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'triggeredById' })
  triggeredBy: User | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationEntityType,
  })
  entityType: NotificationEntityType;

  @Column('uuid')
  entityId: string;

  @Column('text')
  message: string;

  @Column('varchar', { nullable: true })
  actionUrl: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
