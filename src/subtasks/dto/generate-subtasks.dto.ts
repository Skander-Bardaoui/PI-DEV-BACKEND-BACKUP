import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class GenerateSubtasksDto {
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @IsString()
  @IsNotEmpty()
  taskTitle: string;

  @IsString()
  @IsNotEmpty()
  taskDescription: string;
}
