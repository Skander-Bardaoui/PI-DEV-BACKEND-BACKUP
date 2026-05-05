-- Migration: Replace VARCHAR permission strings with JSONB granular permissions
-- This provides per-action permission control instead of generic CRUD

-- Step 1: Add new JSONB columns
ALTER TABLE business_members 
ADD COLUMN IF NOT EXISTS collaboration_permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stock_permissions_jsonb JSONB DEFAULT '{}';

-- Step 2: Migrate existing data from VARCHAR to JSONB based on role
-- BUSINESS_OWNER: Full permissions on everything
UPDATE business_members SET
  collaboration_permissions = '{
    "create_task": true,
    "update_task": true,
    "delete_task": true,
    "add_member": true,
    "kick_member": true,
    "promote_member": true
  }'::jsonb,
  stock_permissions_jsonb = '{
    "create_product": true,
    "update_product": true,
    "delete_product": true,
    "create_movement": true,
    "delete_movement": true,
    "create_category": true,
    "update_category": true,
    "delete_category": true,
    "create_warehouse": true,
    "update_warehouse": true,
    "delete_warehouse": true,
    "create_reservation": true,
    "delete_reservation": true
  }'::jsonb
WHERE role = 'BUSINESS_OWNER';

-- BUSINESS_ADMIN: Full CRUD but no member management
UPDATE business_members SET
  collaboration_permissions = '{
    "create_task": true,
    "update_task": true,
    "delete_task": true,
    "add_member": false,
    "kick_member": false,
    "promote_member": false
  }'::jsonb,
  stock_permissions_jsonb = '{
    "create_product": true,
    "update_product": true,
    "delete_product": true,
    "create_movement": true,
    "delete_movement": true,
    "create_category": true,
    "update_category": true,
    "delete_category": true,
    "create_warehouse": true,
    "update_warehouse": true,
    "delete_warehouse": true,
    "create_reservation": true,
    "delete_reservation": true
  }'::jsonb
WHERE role = 'BUSINESS_ADMIN';

-- TEAM_MEMBER & ACCOUNTANT: Update only
UPDATE business_members SET
  collaboration_permissions = '{
    "create_task": false,
    "update_task": true,
    "delete_task": false,
    "add_member": false,
    "kick_member": false,
    "promote_member": false
  }'::jsonb,
  stock_permissions_jsonb = '{
    "create_product": false,
    "update_product": true,
    "delete_product": false,
    "create_movement": false,
    "delete_movement": false,
    "create_category": false,
    "update_category": false,
    "delete_category": false,
    "create_warehouse": false,
    "update_warehouse": false,
    "delete_warehouse": false,
    "create_reservation": false,
    "delete_reservation": false
  }'::jsonb
WHERE role IN ('TEAM_MEMBER', 'ACCOUNTANT');

-- Step 3: Drop old VARCHAR columns
ALTER TABLE business_members 
DROP COLUMN IF EXISTS permissions,
DROP COLUMN IF EXISTS stock_permissions;

-- Step 4: Rename stock_permissions_jsonb to stock_permissions
ALTER TABLE business_members 
RENAME COLUMN stock_permissions_jsonb TO stock_permissions;

-- Step 5: Verify the migration
SELECT 
  role,
  collaboration_permissions,
  stock_permissions,
  COUNT(*) as count
FROM business_members
GROUP BY role, collaboration_permissions, stock_permissions
ORDER BY role;
