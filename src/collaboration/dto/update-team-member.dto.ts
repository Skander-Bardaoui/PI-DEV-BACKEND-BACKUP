import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { TeamMemberRole } from '../entities/team-member.entity';

export class UpdateTeamMemberDto {
  @IsEnum(TeamMemberRole)
  @IsOptional()
  role?: TeamMemberRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
