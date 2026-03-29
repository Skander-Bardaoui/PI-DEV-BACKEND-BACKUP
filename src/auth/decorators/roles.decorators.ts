// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../../users/enums/role.enum';

// Usage on a route: @Roles(Role.PLATFORM_ADMIN, Role.BUSINESS_OWNER)
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);