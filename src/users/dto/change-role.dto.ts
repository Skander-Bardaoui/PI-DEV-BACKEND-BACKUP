// src/users/dto/change-role.dto.ts
import { IsEnum } from 'class-validator';
import { Role } from '../enums/role.enum';

export class ChangeRoleDto {
  @IsEnum(Role)
  role: Role;
}