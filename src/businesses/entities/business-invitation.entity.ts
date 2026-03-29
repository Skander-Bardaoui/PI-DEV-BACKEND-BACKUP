// src/businesses/entities/business-invitation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/enums/role.enum';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('business_invitations')
export class BusinessInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column()
  email: string; // Email of the person being invited

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role; // Role they will have in the business

  @Column()
  invited_by: string; // User ID of who sent the invitation

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invited_by' })
  inviter: User;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column()
  token: string; // Unique token for accepting invitation

  @Column()
  expires_at: Date; // Invitation expiry (e.g., 7 days)

  @Column({ nullable: true })
  accepted_at: Date;

  @Column({ nullable: true })
  rejected_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
