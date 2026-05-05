import { SetMetadata } from '@nestjs/common';
import { PURCHASE_PERMISSION_KEY } from '../guards/purchase-permission.guard';

/**
 * Decorator to require a specific purchase permission
 * @param permission - The permission key to check (e.g., 'create_supplier', 'send_purchase_order')
 * 
 * @example
 * @RequirePurchasePermission('create_supplier')
 * async createSupplier() { ... }
 */
export const RequirePurchasePermission = (permission: string) =>
  SetMetadata(PURCHASE_PERMISSION_KEY, permission);
