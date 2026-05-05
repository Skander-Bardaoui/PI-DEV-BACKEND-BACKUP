import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Client } from '../../sales/entities/client.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum ClientPortalAccessLevel {
  FULL = 'FULL', // Accès complet (devis, commandes, factures, paiements)
  INVOICES_ONLY = 'INVOICES_ONLY', // Uniquement factures et paiements
  QUOTES_ONLY = 'QUOTES_ONLY', // Uniquement devis
  READ_ONLY = 'READ_ONLY', // Lecture seule
}

@Entity('client_portal_access')
@Unique(['clientId', 'email'])
@Index(['tenantId', 'isActive'])
@Index(['businessId', 'isActive'])
export class ClientPortalAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec Client
  @Column('uuid')
  @Index()
  clientId: string;

  @ManyToOne(() => Client, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  // Relations avec Business
  @Column('uuid')
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  // Relations avec Tenant
  @Column('uuid')
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column('varchar')
  email: string;

  @Column('varchar', { nullable: true })
  password_hash: string | null;

  @Column({
    type: 'enum',
    enum: ClientPortalAccessLevel,
    default: ClientPortalAccessLevel.FULL,
  })
  accessLevel: ClientPortalAccessLevel;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Token d'invitation
  @Column('varchar', { nullable: true })
  invitationToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitationSentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitationAcceptedAt: Date | null;

  // Token de réinitialisation de mot de passe
  @Column('varchar', { nullable: true })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetPasswordExpiresAt: Date | null;

  // Dernière connexion
  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column('varchar', { nullable: true })
  lastLoginIp: string | null;

  // Préférences
  @Column({ type: 'simple-json', nullable: true })
  preferences: {
    language?: string;
    emailNotifications?: boolean;
    documentDownloadNotifications?: boolean;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
