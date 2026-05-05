import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class DetectPriorityDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}
