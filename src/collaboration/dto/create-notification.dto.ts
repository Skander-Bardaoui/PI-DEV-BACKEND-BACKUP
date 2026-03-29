import { IsUUID, IsEnum, IsString } from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  entityType: string;

  @IsUUID()
  entityId: string;

  @IsString()
  message: string;
}
