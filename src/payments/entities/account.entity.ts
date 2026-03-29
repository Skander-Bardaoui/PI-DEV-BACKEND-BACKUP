import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { AccountType } from '../enums/account-type.enum';
import { Business }    from '../../businesses/entities/business.entity';
 
@Entity('accounts')
@Index(['business_id', 'is_active'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
 
  @Column({ type: 'uuid' })
  business_id!: string;
 
  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business!: Business;
 
  @Column()
  name!: string;
 
  @Column({ type: 'enum', enum: AccountType })
  type!: AccountType;
 
  @Column({ nullable: true })
  bank_name?: string;
 
  @Column({ nullable: true, length: 23 })
  rib?: string;
 
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  opening_balance!: number;
 
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  current_balance!: number;
 
  @Column({ default: 'TND' })
  currency!: string;
 
  @Column({ default: true })
  is_active!: boolean;
 
  @Column({ default: false })
  is_default!: boolean;
 
  @OneToMany('Payment', 'account')
  payments!: any[];
 
  // FIX : relation vers SupplierPayment ajoutée
  @OneToMany('SupplierPayment', 'account')
  supplier_payments!: any[];
 
  @OneToMany('Transaction', 'account')
  transactions!: any[];
 
  @CreateDateColumn()
  created_at!: Date;
 
  @UpdateDateColumn()
  updated_at!: Date;
}
 