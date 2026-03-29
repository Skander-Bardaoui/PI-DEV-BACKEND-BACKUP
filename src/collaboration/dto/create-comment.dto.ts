import { IsUUID, IsEnum, IsString } from 'class-validator';
import { CommentEntityType } from '../entities/comment.entity';

export class CreateCommentDto {
  @IsUUID()
  userId: string;

  @IsEnum(CommentEntityType)
  entityType: CommentEntityType;

  @IsUUID()
  entityId: string;

  @IsString()
  content: string;
}
