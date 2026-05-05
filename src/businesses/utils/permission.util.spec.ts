// src/businesses/utils/permission.util.spec.ts
import { PermissionUtil, PermissionType } from './permission.util';
import { Role } from '../../users/enums/role.enum';

describe('PermissionUtil', () => {
  describe('hasPermission', () => {
    it('should return true when permission is granted', () => {
      const permissions = 'cudakp';
      
      expect(PermissionUtil.hasPermission(permissions, PermissionType.CREATE)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.UPDATE)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.DELETE)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.ADD_MEMBER)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.KICK_MEMBER)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.PROMOTE)).toBe(true);
    });

    it('should return false when permission is denied', () => {
      const permissions = '------';
      
      expect(PermissionUtil.hasPermission(permissions, PermissionType.CREATE)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.UPDATE)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.DELETE)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.ADD_MEMBER)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.KICK_MEMBER)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.PROMOTE)).toBe(false);
    });

    it('should handle mixed permissions correctly', () => {
      const permissions = 'c-d-k-';
      
      expect(PermissionUtil.hasPermission(permissions, PermissionType.CREATE)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.UPDATE)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.DELETE)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.ADD_MEMBER)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.KICK_MEMBER)).toBe(true);
      expect(PermissionUtil.hasPermission(permissions, PermissionType.PROMOTE)).toBe(false);
    });

    it('should return false for invalid permission strings', () => {
      expect(PermissionUtil.hasPermission('', PermissionType.CREATE)).toBe(false);
      expect(PermissionUtil.hasPermission('short', PermissionType.CREATE)).toBe(false);
      expect(PermissionUtil.hasPermission('toolong', PermissionType.CREATE)).toBe(false);
      expect(PermissionUtil.hasPermission(null as any, PermissionType.CREATE)).toBe(false);
      expect(PermissionUtil.hasPermission(undefined as any, PermissionType.CREATE)).toBe(false);
    });

    it('should return false for invalid permission types', () => {
      const permissions = 'cudakp';
      
      expect(PermissionUtil.hasPermission(permissions, -1 as PermissionType)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, 6 as PermissionType)).toBe(false);
      expect(PermissionUtil.hasPermission(permissions, 100 as PermissionType)).toBe(false);
    });
  });

  describe('validatePermissionString', () => {
    it('should return true for valid permission strings', () => {
      expect(PermissionUtil.validatePermissionString('cudakp')).toBe(true);
      expect(PermissionUtil.validatePermissionString('------')).toBe(true);
      expect(PermissionUtil.validatePermissionString('c-----')).toBe(true);
      expect(PermissionUtil.validatePermissionString('-u----')).toBe(true);
      expect(PermissionUtil.validatePermissionString('--d---')).toBe(true);
      expect(PermissionUtil.validatePermissionString('---a--')).toBe(true);
      expect(PermissionUtil.validatePermissionString('----k-')).toBe(true);
      expect(PermissionUtil.validatePermissionString('-----p')).toBe(true);
      expect(PermissionUtil.validatePermissionString('cud---')).toBe(true);
      expect(PermissionUtil.validatePermissionString('-u----')).toBe(true);
    });

    it('should return false for invalid permission strings', () => {
      // Wrong length
      expect(PermissionUtil.validatePermissionString('')).toBe(false);
      expect(PermissionUtil.validatePermissionString('short')).toBe(false);
      expect(PermissionUtil.validatePermissionString('toolong')).toBe(false);
      
      // Invalid characters
      expect(PermissionUtil.validatePermissionString('xudakp')).toBe(false);
      expect(PermissionUtil.validatePermissionString('cxdakp')).toBe(false);
      expect(PermissionUtil.validatePermissionString('cuxakp')).toBe(false);
      expect(PermissionUtil.validatePermissionString('cudxkp')).toBe(false);
      expect(PermissionUtil.validatePermissionString('cudaxp')).toBe(false);
      expect(PermissionUtil.validatePermissionString('cudakx')).toBe(false);
      
      // Wrong characters in wrong positions
      expect(PermissionUtil.validatePermissionString('uudakp')).toBe(false); // 'u' in position 0
      expect(PermissionUtil.validatePermissionString('ccdakp')).toBe(false); // 'c' in position 1
      expect(PermissionUtil.validatePermissionString('cuuakp')).toBe(false); // 'u' in position 2
      expect(PermissionUtil.validatePermissionString('cudckp')).toBe(false); // 'c' in position 3
      expect(PermissionUtil.validatePermissionString('cudacp')).toBe(false); // 'c' in position 4
      expect(PermissionUtil.validatePermissionString('cudakc')).toBe(false); // 'c' in position 5
      
      // Null/undefined
      expect(PermissionUtil.validatePermissionString(null as any)).toBe(false);
      expect(PermissionUtil.validatePermissionString(undefined as any)).toBe(false);
    });
  });

  describe('getRoleDefaultPermissions', () => {
    it('should return correct default permissions for each role', () => {
      expect(PermissionUtil.getRoleDefaultPermissions(Role.BUSINESS_OWNER)).toBe('cudakp');
      expect(PermissionUtil.getRoleDefaultPermissions(Role.BUSINESS_ADMIN)).toBe('cud---');
      expect(PermissionUtil.getRoleDefaultPermissions(Role.TEAM_MEMBER)).toBe('-u----');
      expect(PermissionUtil.getRoleDefaultPermissions(Role.ACCOUNTANT)).toBe('-u----');
      expect(PermissionUtil.getRoleDefaultPermissions(Role.CLIENT)).toBe('------');
      expect(PermissionUtil.getRoleDefaultPermissions(Role.SUPPLIER)).toBe('------');
      expect(PermissionUtil.getRoleDefaultPermissions(Role.PLATFORM_ADMIN)).toBe('cudakp');
    });

    it('should return default no permissions for unknown roles', () => {
      expect(PermissionUtil.getRoleDefaultPermissions('UNKNOWN_ROLE' as Role)).toBe('------');
    });
  });

  describe('setPermission', () => {
    it('should set permission correctly when granted', () => {
      let permissions = '------';
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.CREATE, true);
      expect(permissions).toBe('c-----');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.UPDATE, true);
      expect(permissions).toBe('cu----');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.DELETE, true);
      expect(permissions).toBe('cud---');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.ADD_MEMBER, true);
      expect(permissions).toBe('cuda--');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.KICK_MEMBER, true);
      expect(permissions).toBe('cudak-');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.PROMOTE, true);
      expect(permissions).toBe('cudakp');
    });

    it('should remove permission correctly when denied', () => {
      let permissions = 'cudakp';
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.CREATE, false);
      expect(permissions).toBe('-udakp');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.UPDATE, false);
      expect(permissions).toBe('--dakp');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.DELETE, false);
      expect(permissions).toBe('---akp');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.ADD_MEMBER, false);
      expect(permissions).toBe('----kp');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.KICK_MEMBER, false);
      expect(permissions).toBe('-----p');
      
      permissions = PermissionUtil.setPermission(permissions, PermissionType.PROMOTE, false);
      expect(permissions).toBe('------');
    });

    it('should handle invalid permission strings by defaulting to no permissions', () => {
      expect(PermissionUtil.setPermission('', PermissionType.CREATE, true)).toBe('c-----');
      expect(PermissionUtil.setPermission('short', PermissionType.CREATE, true)).toBe('c-----');
      expect(PermissionUtil.setPermission('toolong', PermissionType.CREATE, true)).toBe('c-----');
      expect(PermissionUtil.setPermission(null as any, PermissionType.CREATE, true)).toBe('c-----');
      expect(PermissionUtil.setPermission(undefined as any, PermissionType.CREATE, true)).toBe('c-----');
    });

    it('should toggle permissions correctly', () => {
      let permissions = '------';
      
      // Grant CREATE
      permissions = PermissionUtil.setPermission(permissions, PermissionType.CREATE, true);
      expect(permissions).toBe('c-----');
      expect(PermissionUtil.hasPermission(permissions, PermissionType.CREATE)).toBe(true);
      
      // Revoke CREATE
      permissions = PermissionUtil.setPermission(permissions, PermissionType.CREATE, false);
      expect(permissions).toBe('------');
      expect(PermissionUtil.hasPermission(permissions, PermissionType.CREATE)).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should work correctly with role defaults and permission checking', () => {
      // Test BUSINESS_OWNER
      const ownerPermissions = PermissionUtil.getRoleDefaultPermissions(Role.BUSINESS_OWNER);
      expect(PermissionUtil.hasPermission(ownerPermissions, PermissionType.CREATE)).toBe(true);
      expect(PermissionUtil.hasPermission(ownerPermissions, PermissionType.UPDATE)).toBe(true);
      expect(PermissionUtil.hasPermission(ownerPermissions, PermissionType.DELETE)).toBe(true);
      expect(PermissionUtil.hasPermission(ownerPermissions, PermissionType.ADD_MEMBER)).toBe(true);
      expect(PermissionUtil.hasPermission(ownerPermissions, PermissionType.KICK_MEMBER)).toBe(true);
      expect(PermissionUtil.hasPermission(ownerPermissions, PermissionType.PROMOTE)).toBe(true);
      
      // Test TEAM_MEMBER
      const memberPermissions = PermissionUtil.getRoleDefaultPermissions(Role.TEAM_MEMBER);
      expect(PermissionUtil.hasPermission(memberPermissions, PermissionType.CREATE)).toBe(false);
      expect(PermissionUtil.hasPermission(memberPermissions, PermissionType.UPDATE)).toBe(true);
      expect(PermissionUtil.hasPermission(memberPermissions, PermissionType.DELETE)).toBe(false);
      expect(PermissionUtil.hasPermission(memberPermissions, PermissionType.ADD_MEMBER)).toBe(false);
      expect(PermissionUtil.hasPermission(memberPermissions, PermissionType.KICK_MEMBER)).toBe(false);
      expect(PermissionUtil.hasPermission(memberPermissions, PermissionType.PROMOTE)).toBe(false);
    });

    it('should validate role default permissions', () => {
      const roles = [
        Role.BUSINESS_OWNER,
        Role.BUSINESS_ADMIN,
        Role.TEAM_MEMBER,
        Role.ACCOUNTANT,
        Role.CLIENT,
        Role.SUPPLIER,
        Role.PLATFORM_ADMIN,
      ];
      
      roles.forEach(role => {
        const permissions = PermissionUtil.getRoleDefaultPermissions(role);
        expect(PermissionUtil.validatePermissionString(permissions)).toBe(true);
      });
    });
  });
});