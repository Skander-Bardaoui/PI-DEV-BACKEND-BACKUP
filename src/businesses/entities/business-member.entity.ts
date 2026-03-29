// src/businesses/entities/business-member.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Business } from './business.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/enums/role.enum';

@Entity('business_members')
@Unique(['business_id', 'user_id']) // A user can only be added once per business
export class BusinessMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role; // Role within this specific business

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  invited_by: string; // User ID of who invited this member

  @Column({ nullable: true })
  invited_at: Date;

  @Column({ nullable: true })
  joined_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
