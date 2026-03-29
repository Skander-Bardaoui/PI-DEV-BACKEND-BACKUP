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
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Business } from '../../businesses/entities/business.entity';
import { TeamMemberRole } from './team-member.entity';

export enum InvitationType {
  TEAM_MEMBER = 'TEAM_MEMBER',
  CLIENT_PORTAL = 'CLIENT_PORTAL',
  EXTERNAL_COLLABORATOR = 'EXTERNAL_COLLABORATOR',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('invitations')
@Index(['email', 'status'])
@Index(['tenantId', 'status'])
@Index(['token'])
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec Tenant
  @Column('uuid')
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Relations avec Business (optionnel)
  @Column('uuid', { nullable: true })
  businessId: string | null;

  @ManyToOne(() => Business, { nullable: true })
  @JoinColumn({ name: 'businessId' })
  business: Business | null;

  @Column({
    type: 'enum',
    enum: InvitationType,
  })
  type: InvitationType;

  @Column('varchar')
  email: string;

  @Column('varchar', { nullable: true })
  name: string | null;

  @Column('varchar', { unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  // Invité par
  @Column('uuid')
  invitedById: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy: User;

  // Rôle proposé (pour TEAM_MEMBER)
  @Column({
    type: 'enum',
    enum: TeamMemberRole,
    nullable: true,
  })
  proposedRole: TeamMemberRole | null;

  // Permissions proposées
  @Column({ type: 'simple-json', nullable: true })
  proposedPermissions: Record<string, any> | null;

  // Message personnalisé
  @Column('text', { nullable: true })
  message: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column('text', { nullable: true })
  rejectionReason: string | null;

  // Utilisateur créé suite à l'acceptation
  @Column('uuid', { nullable: true })
  createdUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdUserId' })
  createdUser: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
