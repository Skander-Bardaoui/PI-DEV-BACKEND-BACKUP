#!/usr/bin/env ts-node

/**
 * Script to test permission utility functions
 */

import { PermissionUtil, PermissionType } from '../businesses/utils/permission.util';
import { Role } from '../users/enums/role.enum';

function testPermissionUtils() {
  console.log('🧪 Testing Permission Utility Functions...\n');

  // Test 1: Role Default Permissions
  console.log('1️⃣ Testing Role Default Permissions:');
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
    console.log(`   ${role}: ${permissions}`);
  });

  // Test 2: Permission Validation
  console.log('\n2️⃣ Testing Permission String Validation:');
  const testPermissions = [
    'cudakp', // Valid - all permissions
    'cud---', // Valid - partial permissions
    '-u----', // Valid - single UPDATE permission
    '------', // Valid - no permissions
    'invalid', // Invalid - wrong length
    'cud@kp', // Invalid - invalid character
    'cudakpx', // Invalid - too long
    'cud',     // Invalid - too short
  ];

  testPermissions.forEach(perm => {
    const isValid = PermissionUtil.validatePermissionString(perm);
    console.log(`   "${perm}": ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  // Test 3: Has Permission Check
  console.log('\n3️⃣ Testing Has Permission Check:');
  const testCases = [
    { permissions: 'cudakp', type: PermissionType.CREATE, expected: true },
    { permissions: 'cudakp', type: PermissionType.UPDATE, expected: true },
    { permissions: 'cud---', type: PermissionType.CREATE, expected: true },
    { permissions: 'cud---', type: PermissionType.ADD_MEMBER, expected: false },
    { permissions: '-u----', type: PermissionType.UPDATE, expected: true },
    { permissions: '-u----', type: PermissionType.CREATE, expected: false },
    { permissions: '------', type: PermissionType.CREATE, expected: false },
  ];

  testCases.forEach(({ permissions, type, expected }) => {
    const result = PermissionUtil.hasPermission(permissions, type);
    const status = result === expected ? '✅' : '❌';
    const typeName = Object.keys(PermissionType)[type];
    console.log(`   ${permissions} has ${typeName}: ${result} ${status}`);
  });

  // Test 4: Set Permission
  console.log('\n4️⃣ Testing Set Permission:');
  let testPerm = '------';
  console.log(`   Starting with: ${testPerm}`);
  
  testPerm = PermissionUtil.setPermission(testPerm, PermissionType.CREATE, true);
  console.log(`   After adding CREATE: ${testPerm}`);
  
  testPerm = PermissionUtil.setPermission(testPerm, PermissionType.UPDATE, true);
  console.log(`   After adding UPDATE: ${testPerm}`);
  
  testPerm = PermissionUtil.setPermission(testPerm, PermissionType.CREATE, false);
  console.log(`   After removing CREATE: ${testPerm}`);

  console.log('\n✅ All permission utility tests completed!');
}

// Run the test if called directly
if (require.main === module) {
  testPermissionUtils();
}

export { testPermissionUtils };