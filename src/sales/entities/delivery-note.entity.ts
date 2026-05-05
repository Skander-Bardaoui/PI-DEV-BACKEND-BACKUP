import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';
import { Client } from '../entities/client.entity';
import { DeliveryNoteItem } from './delivery-note-item.entity';
import { SalesOrder } from './sales-order.entity';

@Entity('delivery_notes')
export class DeliveryNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  deliveryNoteNumber: string;

  @Column({ type: 'date' })
  deliveryDate: Date;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Business, { nullable: false })
  business: Business;

  @Column()
  businessId: string;

  @ManyToOne(() => Client, { nullable: false })
  client: Client;

  @Column()
  clientId: string;

  @ManyToOne('SalesOrder', 'deliveryNotes', { nullable: true })
  salesOrder: any;

  @Column({ nullable: true })
  salesOrderId: string;

  @OneToMany(() => DeliveryNoteItem, item => item.deliveryNote, { cascade: true })
  items: DeliveryNoteItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
