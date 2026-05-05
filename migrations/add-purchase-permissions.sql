-- Migration: Add purchase_permissions column to business_members table
-- Date: 2026-05-01

-- Step 1: Add the column
ALTER TABLE business_members
ADD COLUMN IF NOT EXISTS purchase_permissions JSONB DEFAULT '{}';

-- Step 2: Set default permissions for BUSINESS_OWNER
UPDATE business_members 
SET purchase_permissions = '{
  "create_supplier": true,
  "update_supplier": true,
  "delete_supplier": true,
  "create_purchase_order": true,
  "update_purchase_order": true,
  "delete_purchase_order": true,
  "send_purchase_order": true,
  "confirm_purchase_order": true,
  "create_goods_receipt": true,
  "update_goods_receipt": true,
  "delete_goods_receipt": true,
  "validate_goods_receipt": true,
  "create_purchase_invoice": true,
  "update_purchase_invoice": true,
  "delete_purchase_invoice": true,
  "pay_purchase_invoice": true,
  "create_purchase_return": true,
  "update_purchase_return": true,
  "delete_purchase_return": true,
  "approve_purchase_return": true
}'::jsonb
WHERE role = 'BUSINESS_OWNER';

-- Step 3: Set default permissions for BUSINESS_ADMIN
UPDATE business_members 
SET purchase_permissions = '{
  "create_supplier": true,
  "update_supplier": true,
  "delete_supplier": false,
  "create_purchase_order": true,
  "update_purchase_order": true,
  "delete_purchase_order": false,
  "send_purchase_order": true,
  "confirm_purchase_order": true,
  "create_goods_receipt": true,
  "update_goods_receipt": true,
  "delete_goods_receipt": false,
  "validate_goods_receipt": true,
  "create_purchase_invoice": true,
  "update_purchase_invoice": true,
  "delete_purchase_invoice": false,
  "pay_purchase_invoice": true,
  "create_purchase_return": true,
  "update_purchase_return": true,
  "delete_purchase_return": false,
  "approve_purchase_return": true
}'::jsonb
WHERE role = 'BUSINESS_ADMIN';

-- Step 4: Set default permissions for TEAM_MEMBER
UPDATE business_members 
SET purchase_permissions = '{
  "create_supplier": false,
  "update_supplier": false,
  "delete_supplier": false,
  "create_purchase_order": false,
  "update_purchase_order": false,
  "delete_purchase_order": false,
  "send_purchase_order": false,
  "confirm_purchase_order": false,
  "create_goods_receipt": true,
  "update_goods_receipt": false,
  "delete_goods_receipt": false,
  "validate_goods_receipt": false,
  "create_purchase_invoice": false,
  "update_purchase_invoice": false,
  "delete_purchase_invoice": false,
  "pay_purchase_invoice": false,
  "create_purchase_return": false,
  "update_purchase_return": false,
  "delete_purchase_return": false,
  "approve_purchase_return": false
}'::jsonb
WHERE role = 'TEAM_MEMBER';

-- Step 5: Set default permissions for ACCOUNTANT
UPDATE business_members 
SET purchase_permissions = '{
  "create_supplier": true,
  "update_supplier": true,
  "delete_supplier": false,
  "create_purchase_order": false,
  "update_purchase_order": false,
  "delete_purchase_order": false,
  "send_purchase_order": false,
  "confirm_purchase_order": false,
  "create_goods_receipt": false,
  "update_goods_receipt": false,
  "delete_goods_receipt": false,
  "validate_goods_receipt": false,
  "create_purchase_invoice": true,
  "update_purchase_invoice": true,
  "delete_purchase_invoice": false,
  "pay_purchase_invoice": true,
  "create_purchase_return": false,
  "update_purchase_return": false,
  "delete_purchase_return": false,
  "approve_purchase_return": false
}'::jsonb
WHERE role = 'ACCOUNTANT';
