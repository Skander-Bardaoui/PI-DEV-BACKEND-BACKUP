    import {
      Entity,
      PrimaryGeneratedColumn,
      Column,
      CreateDateColumn,
      ManyToOne,
      OneToMany,
      JoinColumn,
      Index,
    } from 'typeorm';
    import { SupplierPO }       from './supplier-po.entity';
    import { Supplier }         from './supplier.entity';
    import { GoodsReceiptItem } from './goods-receipt-item.entity';
    import { Business } from '../../businesses/entities/business.entity';
    import { User } from '../../users/entities/user.entity';

    @Entity('goods_receipts')
    @Index(['business_id'])
    @Index(['supplier_po_id'])
    @Index(['supplier_id'])
    @Index(['business_id', 'gr_number'], { unique: true })
    export class GoodsReceipt {

      @PrimaryGeneratedColumn('uuid')
      id: string;

      // Numéro auto-généré : BR-2024-0001
      @Column({ type: 'varchar', length: 50,})
      gr_number: string;

      // ── Multitenant ───────────────────────────────────────────────
      @Column({ type: 'uuid' })
      business_id: string;

      @ManyToOne(() => Business, { onDelete: 'CASCADE', eager: false })
      @JoinColumn({ name: 'business_id' })
      business: Business;

      // ── Bon de commande source ────────────────────────────────────
      @Column({ type: 'uuid' })
      supplier_po_id: string;

      @Column({ type: 'uuid' })
      supplier_id: string;

      @Column({ type: 'date' })
      receipt_date: Date;

      @Column({ type: 'text', nullable: true })
      notes: string | null;

      // ── Utilisateur qui a validé la réception ─────────────────────
      // Lien vers User (même module Auth) — eager:false pour performance
      @Column({ type: 'uuid' })
      received_by: string;

      @ManyToOne(() => User, { eager: false, onDelete: 'RESTRICT' })
      @JoinColumn({ name: 'received_by' })
      receiver: User;

      @CreateDateColumn({ type: 'timestamptz' })
      created_at: Date;

      // ── Relations ────────────────────────────────────────────────
      // eager:true = le BC et son fournisseur chargés automatiquement
      @ManyToOne(() => SupplierPO, (po) => po.goods_receipts, { eager: true })
      @JoinColumn({ name: 'supplier_po_id' })
      supplier_po: SupplierPO;

      // Direct relation to Supplier for easier queries
      @ManyToOne(() => Supplier, (supplier) => supplier.goods_receipts)
      @JoinColumn({ name: 'supplier_id' })
      supplier: Supplier;

      // cascade:true = les lignes créées/supprimées avec le bon de réception
      @OneToMany(() => GoodsReceiptItem, (item) => item.goods_receipt, { cascade: true })
      items: GoodsReceiptItem[];
    }