// src/payments/entities/supplier-payment.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Account }         from './account.entity';
import { Supplier }        from 'src/Purchases/entities/supplier.entity';
import { PurchaseInvoice } from 'src/Purchases/entities/purchase-invoice.entity';
import { PaymentMethod }   from '../enums/payment-method.enum';

@Entity('supplier_payments')
export class SupplierPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'uuid' })
  supplier_id: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid', nullable: true })
  purchase_invoice_id: string | null;

  @ManyToOne(() => PurchaseInvoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_invoice_id' })
  purchase_invoice: PurchaseInvoice | null;

  @Column({ type: 'uuid', nullable: true })
  account_id: string | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'account_id' })
  account: Account | null;

  // FIX : type varchar explicite obligatoire
  @Column({ type: 'varchar', length: 50, unique: true })
  payment_number: string;

  @Column({ type: 'date' })
  payment_date: Date;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.VIREMENT })
  payment_method: PaymentMethod;

  // FIX : type varchar explicite obligatoire
  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}