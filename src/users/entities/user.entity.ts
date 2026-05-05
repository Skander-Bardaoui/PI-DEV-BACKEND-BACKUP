// src/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  
} from 'typeorm';
import { Role } from '../enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password_hash!: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.BUSINESS_OWNER,
  })
  role!: Role;

  @Column({ default: false })
  is_verified!: boolean;

  @Column({ default: false })
  is_suspended: boolean;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ nullable: true })
  jobTitle?: string;

  @Column({ default: 'fr' })
  preferredLanguage!: string;

  @Column({ default: 'Africa/Tunis' })
  timezone!: string;

  @Column({ nullable: true, default: '#4F46E5' })
  messageColor?: string; // User's preferred message color for chat

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
