// src/clients/entities/client.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  business_id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column()
  name: string;

  @Column() 
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'json', nullable: true })
  address: object;

  @Column({ type: 'int', nullable: true })
  payment_terms: number;

  @Column({ type: 'json', nullable: true })
  billing_details: object;

  @Column({ type: 'json', nullable: true })
  communication_history: object;

  @Column({ type: 'boolean', default: false })
  has_portal_access: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}   