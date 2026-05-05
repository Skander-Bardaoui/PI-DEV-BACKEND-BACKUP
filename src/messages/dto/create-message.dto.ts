import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  fileType?: string;

  @IsOptional()
  fileSize?: number;

  @IsOptional()
  mentions?: string[] | string; // Can be array or JSON string from FormData

  @IsString()
  @IsOptional()
  messageColor?: string; // User's chosen color

  @IsUUID()
  @IsOptional()
  parentMessageId?: string; // For threaded replies
}
