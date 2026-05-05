// src/common/entities/audit-log.entity.ts
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
import { Business } from '../../businesses/entities/business.entity';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  PRINT = 'PRINT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
}

export enum AuditEntityType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  PRODUCT_CATEGORY = 'PRODUCT_CATEGORY',
  SERVICE_CATEGORY = 'SERVICE_CATEGORY',
  STOCK_MOVEMENT = 'STOCK_MOVEMENT',
  WAREHOUSE = 'WAREHOUSE',
  SUPPLIER = 'SUPPLIER',
  SUPPLIER_PO = 'SUPPLIER_PO',
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  CLIENT = 'CLIENT',
  QUOTE = 'QUOTE',
  SALES_ORDER = 'SALES_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  SALES_INVOICE = 'SALES_INVOICE',
  PAYMENT = 'PAYMENT',
}

@Entity('audit_logs')
@Index(['business_id', 'created_at'])
@Index(['entity_type', 'entity_id'])
@Index(['performed_by', 'created_at'])
@Index(['action', 'created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Business context
  @Column({ type: 'uuid' })
  @Index()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  // Action details
  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  // Entity details
  @Column({
    type: 'enum',
    enum: AuditEntityType,
  })
  entity_type: AuditEntityType;

  @Column({ type: 'uuid' })
  @Index()
  entity_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity_name: string | null; // Human-readable name (e.g., product name)

  // User who performed the action
  @Column({ type: 'uuid' })
  @Index()
  performed_by: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'performed_by' })
  user: User;

  // Change tracking (for UPDATE actions)
  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, any> | null;

  // Additional context
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  // Request context
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
