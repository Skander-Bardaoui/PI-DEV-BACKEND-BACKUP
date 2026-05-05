// src/businesses/dto/update-permissions.dto.spec.ts
import { validate } from 'class-validator';
import { UpdatePermissionsDto } from './update-permissions.dto';

describe('UpdatePermissionsDto', () => {
  let dto: UpdatePermissionsDto;

  beforeEach(() => {
    dto = new UpdatePermissionsDto();
  });

  describe('Valid permission strings', () => {
    const validPermissions = [
      'cudakp', // All permissions granted
      '------', // No permissions granted
      'cud---', // Create, Update, Delete only
      '-u----', // Update only (correct position)
      'c-----', // Create only
      '-u----', // Update only
      '--d---', // Delete only
      '---a--', // Add member only
      '----k-', // Kick member only
      '-----p', // Promote only
      'cu-ak-', // Mixed permissions
      '-ud-kp', // Mixed permissions
    ];

    validPermissions.forEach((permissions) => {
      it(`should accept valid permission string: ${permissions}`, async () => {
        dto.permissions = permissions;
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('Invalid permission strings', () => {
    const invalidCases = [
      {
        permissions: '',
        description: 'empty string',
      },
      {
        permissions: 'cudak',
        description: 'too short (5 characters)',
      },
      {
        permissions: 'cudakpp',
        description: 'too long (7 characters)',
      },
      {
        permissions: 'xudakp',
        description: 'invalid character in position 0 (x instead of c or -)',
      },
      {
        permissions: 'cxdakp',
        description: 'invalid character in position 1 (x instead of u or -)',
      },
      {
        permissions: 'cuxakp',
        description: 'invalid character in position 2 (x instead of d or -)',
      },
      {
        permissions: 'cudxkp',
        description: 'invalid character in position 3 (x instead of a or -)',
      },
      {
        permissions: 'cudaxp',
        description: 'invalid character in position 4 (x instead of k or -)',
      },
      {
        permissions: 'cudakx',
        description: 'invalid character in position 5 (x instead of p or -)',
      },
      {
        permissions: 'CUDAKP',
        description: 'uppercase letters',
      },
      {
        permissions: 'c u d a k p',
        description: 'spaces between characters',
      },
      {
        permissions: 'cudakp ',
        description: 'trailing space',
      },
      {
        permissions: ' cudakp',
        description: 'leading space',
      },
      {
        permissions: '123456',
        description: 'numeric characters',
      },
      {
        permissions: 'cudak!',
        description: 'special character (!)',
      },
      {
        permissions: 'cudak@',
        description: 'special character (@)',
      },
      {
        permissions: 'cudak#',
        description: 'special character (#)',
      },
    ];

    invalidCases.forEach(({ permissions, description }) => {
      it(`should reject invalid permission string: ${description}`, async () => {
        dto.permissions = permissions;
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        
        // Check that the error is related to permissions field
        const permissionsError = errors.find(error => error.property === 'permissions');
        expect(permissionsError).toBeDefined();
      });
    });
  });

  describe('Non-string values', () => {
    const nonStringValues = [
      { value: 123456, description: 'number' },
      { value: ['c', 'u', 'd', 'a', 'k', 'p'], description: 'array' },
      { value: { permissions: 'cudakp' }, description: 'object' },
      { value: true, description: 'boolean' },
    ];

    nonStringValues.forEach(({ value, description }) => {
      it(`should reject non-string value: ${description}`, async () => {
        dto.permissions = value as any;
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        
        // Check that the error is related to permissions field
        const permissionsError = errors.find(error => error.property === 'permissions');
        expect(permissionsError).toBeDefined();
      });
    });

    it('should allow null value since field is optional', async () => {
      dto.permissions = null as any;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow undefined value since field is optional', async () => {
      dto.permissions = undefined;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle permission string with mixed valid characters', async () => {
      dto.permissions = 'c-d-k-';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle permission string with all dashes', async () => {
      dto.permissions = '------';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle permission string with all permissions', async () => {
      dto.permissions = 'cudakp';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Validation error messages', () => {
    it('should provide appropriate error message for wrong length', async () => {
      dto.permissions = 'cud';
      const errors = await validate(dto);
      
      const permissionsError = errors.find(error => error.property === 'permissions');
      expect(permissionsError?.constraints).toHaveProperty('isLength');
      expect(permissionsError?.constraints?.isLength).toContain('exactly 6 characters');
    });

    it('should provide appropriate error message for invalid format', async () => {
      dto.permissions = 'xxxxxx';
      const errors = await validate(dto);
      
      const permissionsError = errors.find(error => error.property === 'permissions');
      expect(permissionsError?.constraints).toHaveProperty('matches');
      expect(permissionsError?.constraints?.matches).toContain('Invalid permission string format');
    });

    it('should provide appropriate error message for non-string', async () => {
      dto.permissions = 123456 as any;
      const errors = await validate(dto);
      
      const permissionsError = errors.find(error => error.property === 'permissions');
      expect(permissionsError?.constraints).toHaveProperty('isString');
      expect(permissionsError?.constraints?.isString).toContain('must be a string');
    });
  });
});