import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GoodsReceipt }  from './goods-receipt.entity';
import { SupplierPOItem } from './supplier-po-item.entity';
import { Product }       from '../../stock/entities/product.entity';

@Entity('goods_receipt_items')
@Index(['gr_id'])
@Index(['supplier_po_item_id'])
@Index(['product_id'])
export class GoodsReceiptItem {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Bon de réception parent ───────────────────────────────────
  @Column({ type: 'uuid' })
  gr_id: string;

  @ManyToOne(() => GoodsReceipt, (gr) => gr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gr_id' })
  goods_receipt: GoodsReceipt;

  // ── Ligne du BC correspondante ────────────────────────────────
  @Column({ type: 'uuid' })
  supplier_po_item_id: string;

  @ManyToOne(() => SupplierPOItem, (item) => item.receipt_items, {
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'supplier_po_item_id' })
  supplier_po_item: SupplierPOItem;

  // ── Produit (Module Stock) ────────────────────────────────────
  // Dupliqué depuis SupplierPOItem pour l'appel HTTP vers Module 4
  // sans avoir besoin d'un JOIN supplémentaire
  @Column({ type: 'uuid', nullable: false })
  product_id: string;

  @ManyToOne(() => Product, (p) => p.goodsReceiptItems, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // ── Données de la ligne ───────────────────────────────────────
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity_received: number;

  // Snapshot du prix au moment de la réception
  // Utilisé par Module 4 pour valoriser l'entrée de stock
  @Column({ type: 'decimal', precision: 15, scale: 3 })
  unit_price_ht: number;
}