import { IsEnum, IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { DiscussionStatus } from '../entities/document-discussion.entity';

export class UpdateDocumentDiscussionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(DiscussionStatus)
  status?: DiscussionStatus;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  participantIds?: string[];

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
