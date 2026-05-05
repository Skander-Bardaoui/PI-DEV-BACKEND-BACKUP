import { 
  IsEmail, 
  IsEnum, 
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Role } from '../../users/enums/role.enum';

export class SendInvitationDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum([Role.BUSINESS_ADMIN, Role.TEAM_MEMBER, Role.ACCOUNTANT], { 
    message: 'Invalid role' 
  })
  role: Role;
}
