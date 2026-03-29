import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, IsObject } from 'class-validator';
import { InvitationType } from '../entities/invitation.entity';
import { TeamMemberRole } from '../entities/team-member.entity';

export class CreateInvitationDto {
  @IsEnum(InvitationType)
  type: InvitationType;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  businessId?: string;

  @IsOptional()
  @IsEnum(TeamMemberRole)
  proposedRole?: TeamMemberRole;

  @IsOptional()
  @IsObject()
  proposedPermissions?: Record<string, any>;

  @IsOptional()
  @IsString()
  message?: string;
}
