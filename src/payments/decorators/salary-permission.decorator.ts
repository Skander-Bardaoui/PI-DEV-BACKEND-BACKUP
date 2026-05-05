import { SetMetadata } from '@nestjs/common';
import { SALARY_PERMISSION_KEY } from '../guards/salary-permission.guard';

/**
 * Decorator to require a specific salary permission
 * @param permission - The permission key to check (e.g., 'send_proposal', 'pay_salary')
 * 
 * @example
 * @RequireSalaryPermission('send_proposal')
 * async sendProposal() { ... }
 */
export const RequireSalaryPermission = (permission: string) =>
  SetMetadata(SALARY_PERMISSION_KEY, permission);
