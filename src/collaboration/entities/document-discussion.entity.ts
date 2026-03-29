import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Quote } from '../../sales/entities/quote.entity';
import { SalesOrder } from '../../sales/entities/sales-order.entity';
import { SupplierPO } from 'src/Purchases/entities/supplier-po.entity';
import { PurchaseInvoice } from 'src/Purchases/entities/purchase-invoice.entity';

export enum DocumentType {
  QUOTE = 'QUOTE',
  SALES_ORDER = 'SALES_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  INVOICE = 'INVOICE',
  SUPPLIER_PO = 'SUPPLIER_PO',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  CONTRACT = 'CONTRACT',
  OTHER = 'OTHER',
}

export enum DiscussionStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

@Entity('document_discussions')
@Index(['documentType', 'documentId'])
@Index(['tenantId', 'status'])
@Index(['businessId', 'createdAt'])
export class DocumentDiscussion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec Tenant
  @Column('uuid')
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Relations avec Business
  @Column('uuid', { nullable: true })
  businessId: string | null;

  @ManyToOne(() => Business, { nullable: true })
  @JoinColumn({ name: 'businessId' })
  business: Business | null;

  // Document lié (polymorphe)
  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column('uuid')
  @Index()
  documentId: string;

  // Relations spécifiques (optionnelles)
  @ManyToOne(() => Quote, { nullable: true })
  @JoinColumn({ name: 'documentId' })
  quote: Quote | null;

  @ManyToOne(() => SalesOrder, { nullable: true })
  @JoinColumn({ name: 'documentId' })
  salesOrder: SalesOrder | null;

  @ManyToOne(() => SupplierPO, { nullable: true })
  @JoinColumn({ name: 'documentId' })
  supplierPO: SupplierPO | null;

  @ManyToOne(() => PurchaseInvoice, { nullable: true })
  @JoinColumn({ name: 'documentId' })
  purchaseInvoice: PurchaseInvoice | null;

  @Column('varchar')
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: DiscussionStatus,
    default: DiscussionStatus.OPEN,
  })
  status: DiscussionStatus;

  // Créé par
  @Column('uuid')
  createdById: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  // Participants (liste d'IDs utilisateurs)
  @Column('simple-array')
  participantIds: string[];

  // Résolu par
  @Column('uuid', { nullable: true })
  resolvedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolvedById' })
  resolvedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column('text', { nullable: true })
  resolutionNote: string | null;

  // Pièces jointes
  @Column('simple-json', { nullable: true })
  attachments: { name: string; url: string; size: number; uploadedBy: string }[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
