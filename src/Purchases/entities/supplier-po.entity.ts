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
import { Supplier }        from './supplier.entity';
import { SupplierPOItem }  from './supplier-po-item.entity';
import { GoodsReceipt }    from './goods-receipt.entity';
import { PurchaseInvoice } from './purchase-invoice.entity';
import { POStatus } from '../enum/po-status.enum';
import { Business } from '../../businesses/entities/business.entity';

@Entity('supplier_pos')
@Index(['business_id', 'status'])
@Index(['business_id', 'supplier_id'])
@Index(['business_id', 'po_number'], { unique: true })

export class SupplierPO {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Numéro auto-généré : ACH-2024-0001
  @Column({ type: 'varchar', length: 50 })
  po_number: string;

  @Column({ type: 'enum', enum: POStatus, default: POStatus.DRAFT })
  status: POStatus;

  // ── Multitenant ───────────────────────────────────────────────
  @Column({ type: 'uuid' })
  @Index()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  // ── Fournisseur ───────────────────────────────────────────────
  @Column({ type: 'uuid' })
  supplier_id: string;

  // eager:true = fournisseur chargé automatiquement avec le BC
  @ManyToOne(() => Supplier, (s) => s.supplier_pos, {
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  // ── Dates ─────────────────────────────────────────────────────
  @Column({ type: 'date', nullable: true })
  expected_delivery: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  // ── Montants (calculés depuis les lignes) ─────────────────────
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  subtotal_ht: number;

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  tax_amount: number;

  // Timbre fiscal tunisien fixe à 1,000 DT
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 1.000 })
  timbre_fiscal: number;

  // NET = subtotal_ht + tax_amount + timbre_fiscal
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  net_amount: number;

  // ── Divers ────────────────────────────────────────────────────
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdf_url: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // ── Relations ─────────────────────────────────────────────────
  @OneToMany(() => SupplierPOItem, (item) => item.supplier_po, { cascade: true })
  items: SupplierPOItem[];

  @OneToMany(() => GoodsReceipt, (gr) => gr.supplier_po)
  goods_receipts: GoodsReceipt[];

  // Reverse relation to PurchaseInvoices
  @OneToMany(() => PurchaseInvoice, (invoice) => invoice.supplier_po)
  purchase_invoices: PurchaseInvoice[];
}