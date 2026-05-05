// src/platform-auth/entities/platform-login-attempt.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('platform_login_attempts')
export class PlatformLoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column()
  ip_address!: string;

  @Column()
  success!: boolean;

  @Column({ nullable: true })
  failure_reason?: string;

  @Column({ nullable: true })
  user_agent?: string;

  @CreateDateColumn()
  created_at!: Date;
}
