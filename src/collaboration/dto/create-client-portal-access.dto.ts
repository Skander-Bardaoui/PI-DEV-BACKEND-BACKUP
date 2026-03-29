import { IsEmail, IsEnum, IsOptional, IsUUID, IsObject } from 'class-validator';
import { ClientPortalAccessLevel } from '../entities/client-portal-access.entity';

export class CreateClientPortalAccessDto {
  @IsUUID()
  clientId: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(ClientPortalAccessLevel)
  accessLevel?: ClientPortalAccessLevel;

  @IsOptional()
  @IsObject()
  preferences?: {
    language?: string;
    emailNotifications?: boolean;
    documentDownloadNotifications?: boolean;
  };
}
