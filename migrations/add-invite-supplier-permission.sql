-- Migration: Add invite_supplier permission to purchase_permissions
-- Date: 2026-05-01

-- Update BUSINESS_OWNER - add invite_supplier permission
UPDATE business_members 
SET purchase_permissions = purchase_permissions || '{"invite_supplier": true}'::jsonb
WHERE role = 'BUSINESS_OWNER' AND purchase_permissions IS NOT NULL;

-- Update BUSINESS_ADMIN - add invite_supplier permission
UPDATE business_members 
SET purchase_permissions = purchase_permissions || '{"invite_supplier": true}'::jsonb
WHERE role = 'BUSINESS_ADMIN' AND purchase_permissions IS NOT NULL;

-- Update TEAM_MEMBER - add invite_supplier permission (false)
UPDATE business_members 
SET purchase_permissions = purchase_permissions || '{"invite_supplier": false}'::jsonb
WHERE role = 'TEAM_MEMBER' AND purchase_permissions IS NOT NULL;

-- Update ACCOUNTANT - add invite_supplier permission (false)
UPDATE business_members 
SET purchase_permissions = purchase_permissions || '{"invite_supplier": false}'::jsonb
WHERE role = 'ACCOUNTANT' AND purchase_permissions IS NOT NULL;
