  // src/Purchases/entities/supplier-portal-token.entity.ts
  import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, ManyToOne, JoinColumn,
  } from 'typeorm';
  import { Supplier }    from './supplier.entity';
  import { SupplierPO }  from './supplier-po.entity';

  @Entity('supplier_portal_tokens')
  export class SupplierPortalToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    token: string;           // JWT signé

    @Column()
    business_id: string;

    @Column()
    supplier_id: string;

    @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

      @Column({ type: 'uuid', nullable: true })
      supplier_po_id: string | null;

      @ManyToOne(() => SupplierPO, { nullable: true, onDelete: 'SET NULL' })
      @JoinColumn({ name: 'supplier_po_id' })
      supplier_po: SupplierPO | null;

    @Column({ type: 'timestamp' })
    expires_at: Date;

    @Column({ default: false })
    is_used: boolean;        // révoqué après confirmation/refus

    @CreateDateColumn()
    created_at: Date;
  }