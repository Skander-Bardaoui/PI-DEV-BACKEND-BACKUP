// src/Purchases/entities/dispute-response.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PurchaseInvoice } from './purchase-invoice.entity';
import { Supplier } from './supplier.entity';

export enum DisputeResponseStatus {
  PENDING = 'PENDING',           // En attente de traitement
  ACCEPTED = 'ACCEPTED',         // Acceptée et litige résolu
  REJECTED = 'REJECTED',         // Rejetée, litige non résolu
  REQUIRES_ACTION = 'REQUIRES_ACTION', // Nécessite une action supplémentaire
}

@Entity('dispute_responses')
export class DisputeResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoice_id: string;

  @ManyToOne(() => PurchaseInvoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: PurchaseInvoice;

  @Column({ type: 'uuid' })
  supplier_id: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text' })
  response_message: string;

  @Column({ type: 'text', nullable: true })
  proposed_solution: string;

  @Column({ type: 'decimal', precision: 15, scale: 3, nullable: true })
  proposed_amount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  attachment_url: string; // URL du document justificatif

  @Column({
    type: 'enum',
    enum: DisputeResponseStatus,
    default: DisputeResponseStatus.PENDING,
  })
  status: DisputeResponseStatus;

  @Column({ type: 'text', nullable: true })
  admin_notes: string; // Notes de l'admin après traitement

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  processed_at: Date;
}
