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
import { Business }     from '../../businesses/entities/business.entity';
import { Supplier }     from './supplier.entity';
import { SupplierPO }   from './supplier-po.entity';
import { InvoiceStatus } from '../enum/invoice-status.enum';

@Entity('purchase_invoices')
@Index(['business_id', 'status'])
@Index(['business_id', 'supplier_id'])
@Index(['business_id', 'due_date'])
export class PurchaseInvoice {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Numéro interne auto-généré par notre système : FACT-2026-0001
  @Column({ type: 'varchar', length: 50 })
  invoice_number: string;

  // Numéro figurant sur la facture PAPIER reçue du fournisseur (optionnel)
  // Ce n'est PAS un numéro généré par notre système
  @Column({ type: 'varchar', length: 100, nullable: true })
  invoice_number_supplier: string | null;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

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

  // eager:true = fournisseur toujours chargé avec la facture
  @ManyToOne(() => Supplier, (s) => s.purchase_invoices, {
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  // ── Lien optionnel vers le BC d'origine ───────────────────────
  @Column({ type: 'uuid', nullable: true })
  supplier_po_id: string | null;

  // eager:false = chargé uniquement sur demande explicite
  @ManyToOne(() => SupplierPO, {
    nullable: true,
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'supplier_po_id' })
  supplier_po: SupplierPO | null;

  // ── Lien optionnel vers le BR d'origine ───────────────────────
  // Permet de savoir quelle réception spécifique a été facturée
  @Column({ type: 'uuid', nullable: true })
  goods_receipt_id: string | null;

  // ── Dates ─────────────────────────────────────────────────────
  @Column({ type: 'date' })
  invoice_date: Date;

  // Calculée : invoice_date + supplier.payment_terms jours
  @Column({ type: 'date' })
  due_date: Date;

  // ── Montants saisis depuis la facture papier ──────────────────
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  subtotal_ht: number;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  tax_amount: number;

  // Timbre fiscal tunisien : 1,000 DT par défaut
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 1.000 })
  timbre_fiscal: number;

  // NET = subtotal_ht + tax_amount + timbre_fiscal
  // Toujours recalculé côté serveur, jamais depuis le client
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  net_amount: number;

  // Mis à jour par Module 5 (Trésorerie) à chaque SupplierPayment
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  paid_amount: number;

  // ── Pièce justificative ───────────────────────────────────────
  // URL du scan / photo de la facture papier uploadée
  @Column({ type: 'varchar', length: 500, nullable: true })
  receipt_url: string | null;

  // Raison du litige si status = DISPUTED
  @Column({ type: 'text', nullable: true })
  dispute_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // ── Propriétés calculées (non stockées en DB) ─────────────────
  get remaining_amount(): number {
    return Math.round((Number(this.net_amount) - Number(this.paid_amount)) * 1000) / 1000;
  }

  get is_overdue(): boolean {
    return (
      this.status !== InvoiceStatus.PAID &&
      new Date(this.due_date) < new Date()
    );
  }
}