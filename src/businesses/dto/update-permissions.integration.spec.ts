// src/businesses/dto/update-permissions.integration.spec.ts
import { validate } from 'class-validator';
import { UpdatePermissionsDto } from './update-permissions.dto';
import { PermissionUtil } from '../utils/permission.util';

describe('UpdatePermissionsDto Integration', () => {
  describe('Integration with PermissionUtil', () => {
    it('should accept all permission strings that PermissionUtil considers valid', async () => {
      const validPermissions = [
        'cudakp', // All permissions
        '------', // No permissions
        'cud---', // Business admin default
        '-u----', // Team member default (update in position 1)
        'c-----', // Create only
        '-u----', // Update only
        '--d---', // Delete only
        '---a--', // Add member only
        '----k-', // Kick member only
        '-----p', // Promote only
      ];

      for (const permissions of validPermissions) {
        // Verify PermissionUtil considers it valid
        expect(PermissionUtil.validatePermissionString(permissions)).toBe(true);

        // Verify DTO validation passes
        const dto = new UpdatePermissionsDto();
        dto.permissions = permissions;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject all permission strings that PermissionUtil considers invalid', async () => {
      const invalidPermissions = [
        '', // Empty
        'cud', // Too short
        'cudakpp', // Too long
        'xudakp', // Invalid character
        'CUDAKP', // Uppercase
        '123456', // Numbers
        'c u d a k p', // Spaces
      ];

      for (const permissions of invalidPermissions) {
        // Verify PermissionUtil considers it invalid
        expect(PermissionUtil.validatePermissionString(permissions)).toBe(false);

        // Verify DTO validation fails
        const dto = new UpdatePermissionsDto();
        dto.permissions = permissions;
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate role default permissions correctly', async () => {
      const roleDefaults = {
        BUSINESS_OWNER: 'cudakp',
        BUSINESS_ADMIN: 'cud---',
        TEAM_MEMBER: '-u----',
        ACCOUNTANT: '-u----',
      };

      for (const [role, permissions] of Object.entries(roleDefaults)) {
        // Verify PermissionUtil considers it valid
        expect(PermissionUtil.validatePermissionString(permissions)).toBe(true);

        // Verify DTO validation passes
        const dto = new UpdatePermissionsDto();
        dto.permissions = permissions;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Error message consistency', () => {
    it('should provide clear error messages for common mistakes', async () => {
      const testCases = [
        {
          permissions: 'cud',
          expectedErrorType: 'isLength',
          description: 'too short',
        },
        {
          permissions: 'cudakpp',
          expectedErrorType: 'isLength',
          description: 'too long',
        },
        {
          permissions: 'CUDAKP',
          expectedErrorType: 'matches',
          description: 'uppercase letters',
        },
        {
          permissions: '123456',
          expectedErrorType: 'matches',
          description: 'numeric characters',
        },
      ];

      for (const { permissions, expectedErrorType, description } of testCases) {
        const dto = new UpdatePermissionsDto();
        dto.permissions = permissions;
        const errors = await validate(dto);
        
        expect(errors.length).toBeGreaterThan(0);
        
        const permissionsError = errors.find(error => error.property === 'permissions');
        expect(permissionsError).toBeDefined();
        expect(permissionsError?.constraints).toHaveProperty(expectedErrorType);
      }
    });
  });
});