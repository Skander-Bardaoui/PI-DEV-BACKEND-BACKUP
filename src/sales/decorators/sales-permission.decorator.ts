import { SetMetadata } from '@nestjs/common';
import { SALES_PERMISSION_KEY } from '../guards/sales-permission.guard';

/**
 * Decorator to require a specific sales permission
 * @param permission - The permission key to check (e.g., 'create_client', 'send_invoice')
 * 
 * @example
 * @RequireSalesPermission('create_client')
 * async createClient() { ... }
 */
export const RequireSalesPermission = (permission: string) =>
  SetMetadata(SALES_PERMISSION_KEY, permission);
