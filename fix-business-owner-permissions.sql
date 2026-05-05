-- Fix: Ensure all BUSINESS_OWNER members have full permissions
-- This script updates all existing BUSINESS_OWNER members to have full access
-- across all three permission modules (collaboration, stock, payment)

-- Update all BUSINESS_OWNER members with full permissions
UPDATE business_members SET
  collaboration_permissions = '{
    "create_task": true,
    "update_task": true,
    "delete_task": true,
    "add_member": true,
    "kick_member": true,
    "promote_member": true
  }'::jsonb,
  stock_permissions = '{
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
    "delete_reservation": true,
    "create_service": true,
    "update_service": true,
    "delete_service": true,
    "create_service_category": true,
    "update_service_category": true,
    "delete_service_category": true
  }'::jsonb,
  payment_permissions = '{
    "create_client_payment": true,
    "delete_client_payment": true,
    "create_supplier_payment": true,
    "delete_supplier_payment": true,
    "create_schedule": true,
    "update_schedule": true,
    "delete_schedule": true,
    "pay_installment": true,
    "create_account": true,
    "update_account": true,
    "delete_account": true,
    "create_transfer": true,
    "delete_transfer": true
  }'::jsonb
WHERE role = 'BUSINESS_OWNER';

-- Verification query
SELECT 
  id,
  user_id,
  role,
  collaboration_permissions,
  stock_permissions,
  payment_permissions
FROM business_members 
WHERE role = 'BUSINESS_OWNER'
LIMIT 5;

-- Count affected rows
SELECT COUNT(*) as business_owners_updated
FROM business_members 
WHERE role = 'BUSINESS_OWNER';
