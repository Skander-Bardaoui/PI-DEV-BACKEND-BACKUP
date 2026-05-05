// src/platform-admin/entities/plan.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_monthly!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_annual!: number;

  @Column({ type: 'int', nullable: true })
  max_users?: number;

  @Column({ type: 'int', nullable: true })
  max_businesses?: number;

  @Column({ type: 'jsonb', default: [] })
  features!: string[];

  @Column({ default: true })
  is_active!: boolean;

  @Column({ type: 'boolean', default: false })
  ai_enabled!: boolean;

  @Column({ type: 'int', nullable: true })
  trial_days?: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
