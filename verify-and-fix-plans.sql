-- Verify and Fix AI Access for Plans
-- This script checks and updates the ai_enabled field for all plans

-- 1. Check current plan configuration
SELECT 
  id,
  name,
  slug,
  ai_enabled,
  trial_days,
  is_active,
  features
FROM plans
ORDER BY 
  CASE slug
    WHEN 'free' THEN 1
    WHEN 'standard' THEN 2
    WHEN 'premium' THEN 3
    ELSE 4
  END;

-- 2. Update plans to correct configuration
-- Free plan: NO AI, 7 day trial
UPDATE plans
SET 
  ai_enabled = false,
  trial_days = 7,
  features = ARRAY['full_access', 'duration_7_days']
WHERE slug = 'free';

-- Standard plan: NO AI, no trial
UPDATE plans
SET 
  ai_enabled = false,
  trial_days = NULL,
  features = ARRAY['full_access']
WHERE slug = 'standard';

-- Premium plan: YES AI, no trial
UPDATE plans
SET 
  ai_enabled = true,
  trial_days = NULL,
  features = ARRAY['full_access', 'ai_unlimited']
WHERE slug = 'premium';

-- 3. Verify the updates
SELECT 
  id,
  name,
  slug,
  ai_enabled,
  trial_days,
  is_active,
  features
FROM plans
ORDER BY 
  CASE slug
    WHEN 'free' THEN 1
    WHEN 'standard' THEN 2
    WHEN 'premium' THEN 3
    ELSE 4
  END;

-- 4. Check which tenants have which plans
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.ownerId as owner_id,
  p.name as plan_name,
  p.slug as plan_slug,
  p.ai_enabled,
  s.status as subscription_status,
  s.current_period_end,
  s.trial_ends_at
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id
LEFT JOIN plans p ON p.id = s.plan_id
ORDER BY t.created_at DESC;

-- 5. Test query: Find all users and their AI access
SELECT 
  u.id as user_id,
  u.email,
  u.firstName,
  u.lastName,
  t.id as tenant_id,
  t.name as tenant_name,
  p.name as plan_name,
  p.slug as plan_slug,
  p.ai_enabled as has_ai_access,
  s.status as subscription_status,
  CASE 
    WHEN t.ownerId = u.id THEN 'Owner'
    ELSE 'Member'
  END as user_type
FROM users u
LEFT JOIN tenants t ON t.ownerId = u.id
LEFT JOIN business_members bm ON bm.user_id = u.id
LEFT JOIN businesses b ON b.id = bm.business_id
LEFT JOIN subscriptions s ON s.tenant_id = COALESCE(t.id, b.tenant_id)
LEFT JOIN plans p ON p.id = s.plan_id
WHERE u.is_verified = true
ORDER BY u.created_at DESC;
