// src/platform-auth/entities/platform-refresh-token.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PlatformAdmin } from './platform-admin.entity';

@Entity('platform_refresh_tokens')
export class PlatformRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  token!: string;

  @Column()
  admin_id!: string;

  @ManyToOne(() => PlatformAdmin)
  @JoinColumn({ name: 'admin_id' })
  admin!: PlatformAdmin;

  @Column({ type: 'timestamp' })
  expires_at!: Date;

  @Column({ default: false })
  is_revoked!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
