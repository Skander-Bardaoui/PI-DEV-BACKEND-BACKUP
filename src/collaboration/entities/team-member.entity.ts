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
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Business } from '../../businesses/entities/business.entity';

export enum TeamMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  SALES = 'SALES',
  PURCHASER = 'PURCHASER',
  WAREHOUSE = 'WAREHOUSE',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

@Entity('team_members')
@Unique(['userId', 'tenantId', 'businessId'])
@Index(['tenantId', 'isActive'])
@Index(['businessId', 'isActive'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Relations avec User
  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Relations avec Tenant
  @Column('uuid')
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Relations avec Business (optionnel - pour permissions spécifiques à une entreprise)
  @Column('uuid', { nullable: true })
  businessId: string | null;

  @ManyToOne(() => Business, { nullable: true })
  @JoinColumn({ name: 'businessId' })
  business: Business | null;

  @Column({
    type: 'enum',
    enum: TeamMemberRole,
    default: TeamMemberRole.MEMBER,
  })
  role: TeamMemberRole;

  // Permissions granulaires (JSON)
  @Column({ type: 'simple-json', nullable: true })
  permissions: {
    canManageTeam?: boolean;
    canManageClients?: boolean;
    canManageProducts?: boolean;
    canManageSales?: boolean;
    canManagePurchases?: boolean;
    canManagePayments?: boolean;
    canViewReports?: boolean;
    canExportData?: boolean;
  } | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Invitation
  @Column('varchar', { nullable: true })
  invitationToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitationSentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitationAcceptedAt: Date | null;

  @Column('uuid', { nullable: true })
  invitedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastAccessAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
