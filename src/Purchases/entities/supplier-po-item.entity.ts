import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { SupplierPO }       from './supplier-po.entity';
import { Product }          from '../../stock/entities/product.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';

@Entity('supplier_po_items')
@Index(['supplier_po_id'])
@Index(['product_id'])
export class SupplierPOItem {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Lien vers le BC parent ────────────────────────────────────
  @Column({ type: 'uuid' })
  supplier_po_id: string;

  @ManyToOne(() => SupplierPO, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_po_id' })
  supplier_po: SupplierPO;

  // ── Lien vers le produit (Module Stock) ───────────────────────
  // nullable : commande possible pour un produit hors catalogue
  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  // eager:false pour éviter les chargements inutiles
  @ManyToOne(() => Product, (p) => p.supplierPOItems, {
    nullable: true,
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  // ── Données de la ligne ───────────────────────────────────────
  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity_ordered: number;

  // Mis à jour à chaque GoodsReceipt
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity_received: number;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  unit_price_ht: number;

  // Snapshot TVA au moment de la création : 0, 7, 13 ou 19
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  tax_rate_value: number;

  // Calculés et stockés (évite de recalculer à chaque lecture)
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  line_total_ht: number;   // quantity_ordered × unit_price_ht

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  line_tax: number;        // line_total_ht × (tax_rate_value / 100)

  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  // ── Relations inverses ────────────────────────────────────────
  @OneToMany(() => GoodsReceiptItem, (gri) => gri.supplier_po_item)
  receipt_items: GoodsReceiptItem[];
}