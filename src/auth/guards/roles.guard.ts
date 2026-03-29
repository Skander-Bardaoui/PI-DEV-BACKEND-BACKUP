// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../users/enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read the roles array that was set by the @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator on this route, anyone authenticated can access it
    if (!requiredRoles) {
      return true;
    }

    // The user object was attached to the request by the JwtStrategy
    const { user } = context.switchToHttp().getRequest();

    // Check if the user's role is in the list of allowed roles
    return requiredRoles.some((role) => user.role === role);
  }
}