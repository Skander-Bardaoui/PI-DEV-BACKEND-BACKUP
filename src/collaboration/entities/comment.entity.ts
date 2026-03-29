import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Task } from './task.entity';
import { Quote } from '../../sales/entities/quote.entity';
import { SalesOrder } from '../../sales/entities/sales-order.entity';
import { SupplierPO } from 'src/Purchases/entities/supplier-po.entity';
import { PurchaseInvoice } from 'src/Purchases/entities/purchase-invoice.entity';


export enum CommentEntityType {
  TASK = 'TASK',
  QUOTE = 'QUOTE',
  SALES_ORDER = 'SALES_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',
  SUPPLIER_PO = 'SUPPLIER_PO',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  CLIENT = 'CLIENT',
}

@Entity('comments')
@Index(['entityType', 'entityId'])
@Index(['userId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec User (auteur du commentaire)
  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Type d'entité commentée (polymorphe)
  @Column({
    type: 'enum',
    enum: CommentEntityType,
  })
  entityType: CommentEntityType;

  @Column('uuid')
  @Index()
  entityId: string;

  // Relations spécifiques (optionnelles, selon entityType)
  @ManyToOne(() => Task, (task) => task.comments, { nullable: true })
  @JoinColumn({ name: 'entityId' })
  task: Task | null;

  @ManyToOne(() => Quote, { nullable: true })
  @JoinColumn({ name: 'entityId' })
  quote: Quote | null;

  @ManyToOne(() => SalesOrder, { nullable: true })
  @JoinColumn({ name: 'entityId' })
  salesOrder: SalesOrder | null;

  @ManyToOne(() => SupplierPO, { nullable: true })
  @JoinColumn({ name: 'entityId' })
  supplierPO: SupplierPO | null;

  @ManyToOne(() => PurchaseInvoice, { nullable: true })
  @JoinColumn({ name: 'entityId' })
  purchaseInvoice: PurchaseInvoice | null;

  @Column('text')
  content: string;

  // Support des mentions (@user)
  @Column('simple-array', { nullable: true })
  mentionedUserIds: string[] | null;

  // Support des pièces jointes
  @Column('simple-json', { nullable: true })
  attachments: { name: string; url: string; size: number }[] | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column('uuid', { nullable: true })
  parentCommentId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
