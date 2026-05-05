-- Migration: Add sales_permissions column to business_members table
-- Date: 2026-05-01

-- Step 1: Add the sales_permissions column
ALTER TABLE business_members
ADD COLUMN IF NOT EXISTS sales_permissions JSONB DEFAULT '{}';

-- Step 2: Set default permissions for BUSINESS_OWNER
UPDATE business_members 
SET sales_permissions = '{
  "create_client": true,
  "update_client": true,
  "delete_client": true,
  "invite_client": true,
  "create_quote": true,
  "update_quote": true,
  "delete_quote": true,
  "send_quote": true,
  "convert_quote": true,
  "create_order": true,
  "update_order": true,
  "cancel_order": true,
  "create_delivery": true,
  "update_delivery": true,
  "cancel_delivery": true,
  "create_invoice": true,
  "update_invoice": true,
  "delete_invoice": true,
  "send_invoice": true,
  "create_recurring": true,
  "update_recurring": true,
  "delete_recurring": true
}'::jsonb
WHERE role = 'BUSINESS_OWNER';

-- Step 3: Set default permissions for BUSINESS_ADMIN
UPDATE business_members 
SET sales_permissions = '{
  "create_client": true,
  "update_client": true,
  "delete_client": false,
  "invite_client": true,
  "create_quote": true,
  "update_quote": true,
  "delete_quote": false,
  "send_quote": true,
  "convert_quote": true,
  "create_order": true,
  "update_order": true,
  "cancel_order": false,
  "create_delivery": true,
  "update_delivery": true,
  "cancel_delivery": false,
  "create_invoice": true,
  "update_invoice": true,
  "delete_invoice": false,
  "send_invoice": true,
  "create_recurring": true,
  "update_recurring": true,
  "delete_recurring": false
}'::jsonb
WHERE role = 'BUSINESS_ADMIN';

-- Step 4: Set default permissions for TEAM_MEMBER
UPDATE business_members 
SET sales_permissions = '{
  "create_client": false,
  "update_client": false,
  "delete_client": false,
  "invite_client": false,
  "create_quote": true,
  "update_quote": false,
  "delete_quote": false,
  "send_quote": false,
  "convert_quote": false,
  "create_order": false,
  "update_order": false,
  "cancel_order": false,
  "create_delivery": false,
  "update_delivery": false,
  "cancel_delivery": false,
  "create_invoice": false,
  "update_invoice": false,
  "delete_invoice": false,
  "send_invoice": false,
  "create_recurring": false,
  "update_recurring": false,
  "delete_recurring": false
}'::jsonb
WHERE role = 'TEAM_MEMBER';

-- Step 5: Set default permissions for ACCOUNTANT
UPDATE business_members 
SET sales_permissions = '{
  "create_client": true,
  "update_client": true,
  "delete_client": false,
  "invite_client": false,
  "create_quote": true,
  "update_quote": true,
  "delete_quote": false,
  "send_quote": true,
  "convert_quote": false,
  "create_order": false,
  "update_order": false,
  "cancel_order": false,
  "create_delivery": false,
  "update_delivery": false,
  "cancel_delivery": false,
  "create_invoice": true,
  "update_invoice": false,
  "delete_invoice": false,
  "send_invoice": true,
  "create_recurring": false,
  "update_recurring": false,
  "delete_recurring": false
}'::jsonb
WHERE role = 'ACCOUNTANT';
