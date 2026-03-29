  // src/Purchases/entities/purchase-alert.entity.ts
  import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, ManyToOne, JoinColumn,
  } from 'typeorm';
import { AlertStatus } from '../enum/alertStatus';
import { AlertSeverity } from '../enum/alertSeverity';

  export enum AlertType {
    INVOICE_DUE_SOON     = 'INVOICE_DUE_SOON',      // Facture échéance J-7, J-3, J-1
    INVOICE_OVERDUE      = 'INVOICE_OVERDUE',         // Facture en retard
    PO_NOT_RECEIVED      = 'PO_NOT_RECEIVED',         // BC confirmé non réceptionné depuis X jours
    SUPPLIER_HIGH_DEBT   = 'SUPPLIER_HIGH_DEBT',      // Solde impayé fournisseur dépasse seuil
    INVOICE_HIGH_AMOUNT  = 'INVOICE_HIGH_AMOUNT',     // Facture d'un montant inhabituel
    PO_AWAITING_CONFIRM  = 'PO_AWAITING_CONFIRM',     // BC envoyé non confirmé depuis X jours
  }



  @Entity('purchase_alerts')
  export class PurchaseAlert {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    business_id: string;

    @Column({ type: 'enum', enum: AlertType })
    type: AlertType;

    @Column({ type: 'enum', enum: AlertSeverity })
    severity: AlertSeverity;

    @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.UNREAD })
    status: AlertStatus;

    @Column()
    title: string;

    @Column({ type: 'text' })
    message: string;

    // Entité concernée (facture, BC, fournisseur)
    @Column({ nullable: true })
    entity_type: string;

    @Column({ nullable: true })
    entity_id: string;

    @Column({ nullable: true })
    entity_label: string; // ex: "FACT-2026-0012", "ACH-2026-0005"

    // Données supplémentaires (montant, nb jours, etc.)
    @Column({ type: 'json', nullable: true })
    metadata: Record<string, any>;

    // Email de notification envoyé
    @Column({ default: false })
    email_sent: boolean;

    // Snooze jusqu'à
    @Column({ type: 'timestamp', nullable: true })
    snoozed_until: Date | null;

    @CreateDateColumn()
    created_at: Date;
  }