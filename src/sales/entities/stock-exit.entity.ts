import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { StockExitItem } from './stock-exit-item.entity';

@Entity('stock_exits')
export class StockExit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exitNumber: string;

  @Column({ type: 'date' })
  exitDate: Date;

  @Column({ default: 'completed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Business, { nullable: false })
  business: Business;

  @Column()
  businessId: string;

  @ManyToOne('DeliveryNote', { nullable: true })
  deliveryNote: any;

  @Column({ nullable: true })
  deliveryNoteId: string;

  @OneToMany(() => StockExitItem, item => item.stockExit, { cascade: true })
  items: StockExitItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
