import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Task } from '../../tasks/entities/task.entity';
import { Subtask } from '../../subtasks/entities/subtask.entity';

export enum ActivityType {
  SUBTASK_COMPLETED = 'SUBTASK_COMPLETED',
  SUBTASK_COMPLETED_OVERDUE = 'SUBTASK_COMPLETED_OVERDUE',
  SUBTASK_COMPLETED_ON_TIME = 'SUBTASK_COMPLETED_ON_TIME',
  TASK_BLOCKED = 'TASK_BLOCKED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
}

@Entity('activity')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @Column()
  businessId: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  taskId: string;

  @ManyToOne(() => Task, { eager: true, nullable: true })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ nullable: true })
  subtaskId: string;

  @ManyToOne(() => Subtask, { eager: true, nullable: true })
  @JoinColumn({ name: 'subtaskId' })
  subtask: Subtask;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  isOverdue: boolean;

  @Column({ type: 'boolean', default: false })
  isOnTime: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
