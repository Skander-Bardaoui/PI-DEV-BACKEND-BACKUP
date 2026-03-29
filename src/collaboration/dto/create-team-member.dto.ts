import { IsUUID, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { TeamMemberRole } from '../entities/team-member.entity';

export class CreateTeamMemberDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  tenantId: string;

  @IsEnum(TeamMemberRole)
  role: TeamMemberRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
