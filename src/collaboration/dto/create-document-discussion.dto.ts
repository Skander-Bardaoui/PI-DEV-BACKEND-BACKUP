import { IsEnum, IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
import { DocumentType } from '../entities/document-discussion.entity';

export class CreateDocumentDiscussionDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsUUID()
  documentId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  participantIds?: string[];

  @IsOptional()
  attachments?: { name: string; url: string; size: number }[];
}
