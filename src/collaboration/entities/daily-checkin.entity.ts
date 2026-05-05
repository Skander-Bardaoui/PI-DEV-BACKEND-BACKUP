import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../businesses/entities/business.entity';

@Entity('daily_checkins')
@Unique(['userId', 'checkinDate'])
@Index(['businessId', 'checkinDate'])
export class DailyCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  @Index()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column('uuid', { array: true, default: [] })
  taskIds: string[];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'boolean', default: false })
  skipped: boolean;

  @Column({ type: 'date' })
  @Index()
  checkinDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
