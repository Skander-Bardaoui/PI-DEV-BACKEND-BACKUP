import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TaskStatus, TaskPriority } from '../entities/task.entity';

export class MoveTaskDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsInt()
  @Min(0)
  order: number;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}
