// src/businesses/decorators/permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PermissionType } from '../utils/permission.util';
import { PERMISSION_KEY } from '../guards/permission.guard';

/**
 * Decorator to require a specific permission for route access
 */
export const RequirePermission = (permission: PermissionType) =>
  SetMetadata(PERMISSION_KEY, permission);

/**
 * Convenience decorators for common permissions
 */
export const RequireCreate = () => RequirePermission(PermissionType.CREATE);
export const RequireUpdate = () => RequirePermission(PermissionType.UPDATE);
export const RequireDelete = () => RequirePermission(PermissionType.DELETE);
export const RequireAddMember = () => RequirePermission(PermissionType.ADD_MEMBER);
export const RequireKickMember = () => RequirePermission(PermissionType.KICK_MEMBER);
export const RequirePromote = () => RequirePermission(PermissionType.PROMOTE);