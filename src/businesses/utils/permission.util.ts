// src/businesses/utils/permission.util.ts
import { Role } from '../../users/enums/role.enum';

export enum PermissionType {
  CREATE = 0,
  UPDATE = 1,
  DELETE = 2,
  ADD_MEMBER = 3,
  KICK_MEMBER = 4,
  PROMOTE = 5,
}

export class PermissionUtil {
  /**
   * Check if a permission string has a specific permission
   */
  static hasPermission(permissions: string, type: PermissionType): boolean {
    if (!permissions || permissions.length !== 6) {
      return false;
    }
    
    if (type < 0 || type > 5) {
      return false;
    }
    
    return permissions[type] !== '-';
  }

  /**
   * Validate permission string format
   */
  static validatePermissionString(permissions: string): boolean {
    if (!permissions || permissions.length !== 6) {
      return false;
    }
    
    const positions = [
      ['c', '-'], // Position 0: Create
      ['u', '-'], // Position 1: Update
      ['d', '-'], // Position 2: Delete
      ['a', '-'], // Position 3: Add member
      ['k', '-'], // Position 4: Kick member
      ['p', '-'], // Position 5: Promote
    ];
    
    for (let i = 0; i < 6; i++) {
      if (!positions[i].includes(permissions[i])) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get default collaboration permissions for a role
   */
  static getRoleDefaultCollaborationPermissions(role: Role): Record<string, boolean> {
    const defaults: Record<string, Record<string, boolean>> = {
      [Role.BUSINESS_OWNER]: {
        create_task: true,
        update_task: true,
        delete_task: true,
        create_subtask: true,
        update_subtask: true,
        delete_subtask: true,
        mark_complete_subtask: true,
        add_member: true,
        kick_member: true,
        promote_member: true,
      },
      [Role.BUSINESS_ADMIN]: {
        create_task: true,
        update_task: true,
        delete_task: true,
        create_subtask: true,
        update_subtask: true,
        delete_subtask: true,
        mark_complete_subtask: true,
        add_member: false,
        kick_member: false,
        promote_member: false,
      },
      [Role.TEAM_MEMBER]: {
        create_task: false,
        update_task: true,
        delete_task: false,
        create_subtask: true,
        update_subtask: true,
        delete_subtask: false,
        mark_complete_subtask: true,
        add_member: false,
        kick_member: false,
        promote_member: false,
      },
      [Role.ACCOUNTANT]: {
        create_task: false,
        update_task: true,
        delete_task: false,
        create_subtask: true,
        update_subtask: true,
        delete_subtask: false,
        mark_complete_subtask: true,
        add_member: false,
        kick_member: false,
        promote_member: false,
      },
      [Role.CLIENT]: {},
      [Role.SUPPLIER]: {},
      [Role.PLATFORM_ADMIN]: {
        create_task: true,
        update_task: true,
        delete_task: true,
        create_subtask: true,
        update_subtask: true,
        delete_subtask: true,
        mark_complete_subtask: true,
        add_member: true,
        kick_member: true,
        promote_member: true,
      },
    };
    
    return defaults[role] ?? {};
  }

  /**
   * Get default stock permissions for a role
   */
  static getRoleDefaultStockPermissions(role: Role): Record<string, boolean> {
    const defaults: Record<string, Record<string, boolean>> = {
      [Role.BUSINESS_OWNER]: {
        create_product: true,
        update_product: true,
        delete_product: true,
        create_movement: true,
        delete_movement: true,
        create_category: true,
        update_category: true,
        delete_category: true,
        create_warehouse: true,
        update_warehouse: true,
        delete_warehouse: true,
        create_reservation: true,
        delete_reservation: true,
        create_service: true,
        update_service: true,
        delete_service: true,
        create_service_category: true,
        update_service_category: true,
        delete_service_category: true,
      },
      [Role.BUSINESS_ADMIN]: {
        create_product: true,
        update_product: true,
        delete_product: true,
        create_movement: true,
        delete_movement: true,
        create_category: true,
        update_category: true,
        delete_category: true,
        create_warehouse: true,
        update_warehouse: true,
        delete_warehouse: true,
        create_reservation: true,
        delete_reservation: true,
        create_service: true,
        update_service: true,
        delete_service: true,
        create_service_category: true,
        update_service_category: true,
        delete_service_category: true,
      },
      [Role.TEAM_MEMBER]: {
        create_product: false,
        update_product: true,
        delete_product: false,
        create_movement: false,
        delete_movement: false,
        create_category: false,
        update_category: false,
        delete_category: false,
        create_warehouse: false,
        update_warehouse: false,
        delete_warehouse: false,
        create_reservation: false,
        delete_reservation: false,
        create_service: false,
        update_service: true,
        delete_service: false,
        create_service_category: false,
        update_service_category: false,
        delete_service_category: false,
      },
      [Role.ACCOUNTANT]: {
        create_product: false,
        update_product: true,
        delete_product: false,
        create_movement: false,
        delete_movement: false,
        create_category: false,
        update_category: false,
        delete_category: false,
        create_warehouse: false,
        update_warehouse: false,
        delete_warehouse: false,
        create_reservation: false,
        delete_reservation: false,
        create_service: false,
        update_service: true,
        delete_service: false,
        create_service_category: false,
        update_service_category: false,
        delete_service_category: false,
      },
      [Role.CLIENT]: {},
      [Role.SUPPLIER]: {},
      [Role.PLATFORM_ADMIN]: {
        create_product: true,
        update_product: true,
        delete_product: true,
        create_movement: true,
        delete_movement: true,
        create_category: true,
        update_category: true,
        delete_category: true,
        create_warehouse: true,
        update_warehouse: true,
        delete_warehouse: true,
        create_reservation: true,
        delete_reservation: true,
        create_service: true,
        update_service: true,
        delete_service: true,
        create_service_category: true,
        update_service_category: true,
        delete_service_category: true,
      },
    };
    
    return defaults[role] ?? {};
  }

  /**
   * Get default payment permissions for a role
   */
  static getRoleDefaultPaymentPermissions(role: Role): Record<string, boolean> {
    const defaults: Record<string, Record<string, boolean>> = {
      [Role.BUSINESS_OWNER]: {
        create_client_payment: true,
        delete_client_payment: true,
        create_supplier_payment: true,
        delete_supplier_payment: true,
        create_schedule: true,
        update_schedule: true,
        delete_schedule: true,
        pay_installment: true,
        create_account: true,
        update_account: true,
        delete_account: true,
        create_transfer: true,
        delete_transfer: true,
      },
      [Role.BUSINESS_ADMIN]: {
        create_client_payment: true,
        delete_client_payment: false,
        create_supplier_payment: true,
        delete_supplier_payment: false,
        create_schedule: true,
        update_schedule: true,
        delete_schedule: false,
        pay_installment: true,
        create_account: false,
        update_account: false,
        delete_account: false,
        create_transfer: true,
        delete_transfer: false,
      },
      [Role.TEAM_MEMBER]: {
        create_client_payment: false,
        delete_client_payment: false,
        create_supplier_payment: false,
        delete_supplier_payment: false,
        create_schedule: false,
        update_schedule: false,
        delete_schedule: false,
        pay_installment: false,
        create_account: false,
        update_account: false,
        delete_account: false,
        create_transfer: false,
        delete_transfer: false,
      },
      [Role.ACCOUNTANT]: {
        create_client_payment: true,
        delete_client_payment: false,
        create_supplier_payment: true,
        delete_supplier_payment: false,
        create_schedule: true,
        update_schedule: false,
        delete_schedule: false,
        pay_installment: true,
        create_account: false,
        update_account: false,
        delete_account: false,
        create_transfer: false,
        delete_transfer: false,
      },
      [Role.CLIENT]: {},
      [Role.SUPPLIER]: {},
      [Role.PLATFORM_ADMIN]: {
        create_client_payment: true,
        delete_client_payment: true,
        create_supplier_payment: true,
        delete_supplier_payment: true,
        create_schedule: true,
        update_schedule: true,
        delete_schedule: true,
        pay_installment: true,
        create_account: true,
        update_account: true,
        delete_account: true,
        create_transfer: true,
        delete_transfer: true,
      },
    };
    
    return defaults[role] || {};
  }

  /**
   * Check if a member has a specific granular permission
   */
  static hasGranularPermission(
    permissions: Record<string, boolean> | undefined,
    permissionKey: string,
  ): boolean {
    return permissions?.[permissionKey] ?? false;
  }

  /**
   * Set a specific permission in a permission string
   */
  static setPermission(
    permissions: string,
    type: PermissionType,
    granted: boolean,
  ): string {
    if (!permissions || permissions.length !== 6) {
      permissions = '------';
    }
    
    const chars = permissions.split('');
    const permissionChars = ['c', 'u', 'd', 'a', 'k', 'p'];
    chars[type] = granted ? permissionChars[type] : '-';
    return chars.join('');
  }

  /**
   * Get default permissions string for a role (legacy format)
   * This method is used by tests and maintains backward compatibility
   */
  static getRoleDefaultPermissions(role: Role): string {
    const defaults: Record<string, string> = {
      [Role.BUSINESS_OWNER]: 'cudakp',
      [Role.BUSINESS_ADMIN]: 'cud---',
      [Role.TEAM_MEMBER]: '-u----',
      [Role.ACCOUNTANT]: '-u----',
      [Role.CLIENT]: '------',
      [Role.SUPPLIER]: '------',
      [Role.PLATFORM_ADMIN]: 'cudakp',
    };
    
    return defaults[role] ?? '------';
  }
}