import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsUUID, 
  IsDateString, 
  IsArray,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../entities/task.entity';
import { IsNotPastDate } from '../validators/is-not-past-date.validator';

export class CreateTaskDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(100, { message: 'Title must not exceed 100 characters' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsNotEmpty({ message: 'Priority is required' })
  @IsEnum(TaskPriority, { message: 'Priority must be LOW, MEDIUM or HIGH' })
  priority: TaskPriority;

  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(TaskStatus, { message: 'Status must be TODO, IN_PROGRESS, DONE or BLOCKED' })
  status: TaskStatus;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignedToIds?: string[];

  @IsOptional()
  @IsDateString({}, { message: 'Due date must be a valid date' })
  @IsNotPastDate()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;
}
