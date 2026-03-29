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
import { Business }       from '../../businesses/entities/business.entity';
import { SupplierPO }     from './supplier-po.entity';
import { PurchaseInvoice } from './purchase-invoice.entity';
import { GoodsReceipt } from './goods-receipt.entity';

@Entity('suppliers')
@Index(['business_id', 'is_active'])
@Index(['business_id', 'name'])
export class Supplier {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Multitenant ───────────────────────────────────────────────
  @Column({ type: 'uuid' })
  @Index()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  // ── Informations fournisseur ──────────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  matricule_fiscal: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address: {
    street?:      string;
    city?:        string;
    postal_code?: string;
    country?:     string;
  } | null;

  // ── Coordonnées bancaires ─────────────────────────────────────
  @Column({ type: 'varchar', length: 50, nullable: true })
  rib: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_name: string | null;

  // ── Conditions commerciales ───────────────────────────────────
  // Utilisé pour calculer due_date = invoice_date + payment_terms jours
  @Column({ type: 'integer', default: 30 })
  payment_terms: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  // ── Soft delete ───────────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // ── Relations inverses ────────────────────────────────────────
  @OneToMany(() => SupplierPO, (po) => po.supplier)
  supplier_pos: SupplierPO[];

  @OneToMany(() => PurchaseInvoice, (inv) => inv.supplier)
  purchase_invoices: PurchaseInvoice[];

@OneToMany(() => GoodsReceipt, (gr) => gr.supplier)
goods_receipts: GoodsReceipt[];
}