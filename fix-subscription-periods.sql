-- Fix Subscription Periods
-- This script corrects the subscription periods based on plan type and billing cycle

-- 1. Check current subscription periods
SELECT 
  s.id,
  t.name as tenant_name,
  p.name as plan_name,
  p.slug as plan_slug,
  s.billing_cycle,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.trial_ends_at,
  EXTRACT(DAY FROM (s.current_period_end - s.current_period_start)) as days_in_period
FROM subscriptions s
JOIN tenants t ON t.id = s.tenant_id
JOIN plans p ON p.id = s.plan_id
ORDER BY s.created_at DESC;

-- 2. Fix Free plan subscriptions (should be 7 days)
UPDATE subscriptions s
SET 
  current_period_end = current_period_start + INTERVAL '7 days',
  trial_ends_at = current_period_start + INTERVAL '7 days',
  next_billing_at = NULL
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug = 'free'
  AND s.status IN ('active', 'pending_payment', 'payment_submitted');

-- 3. Fix Standard/Premium Monthly subscriptions (should be 30 days)
UPDATE subscriptions s
SET 
  current_period_end = current_period_start + INTERVAL '30 days',
  trial_ends_at = NULL,
  next_billing_at = current_period_start + INTERVAL '30 days'
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug IN ('standard', 'premium')
  AND s.billing_cycle = 'monthly'
  AND s.status IN ('active', 'pending_payment', 'payment_submitted');

-- 4. Fix Standard/Premium Annual subscriptions (should be 365 days)
UPDATE subscriptions s
SET 
  current_period_end = current_period_start + INTERVAL '365 days',
  trial_ends_at = NULL,
  next_billing_at = current_period_start + INTERVAL '365 days'
FROM plans p
WHERE s.plan_id = p.id
  AND p.slug IN ('standard', 'premium')
  AND s.billing_cycle = 'annual'
  AND s.status IN ('active', 'pending_payment', 'payment_submitted');

-- 5. Verify the fixes
SELECT 
  s.id,
  t.name as tenant_name,
  p.name as plan_name,
  p.slug as plan_slug,
  s.billing_cycle,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.trial_ends_at,
  EXTRACT(DAY FROM (s.current_period_end - s.current_period_start)) as days_in_period,
  CASE 
    WHEN p.slug = 'free' THEN '7 days expected'
    WHEN s.billing_cycle = 'monthly' THEN '30 days expected'
    WHEN s.billing_cycle = 'annual' THEN '365 days expected'
  END as expected_period
FROM subscriptions s
JOIN tenants t ON t.id = s.tenant_id
JOIN plans p ON p.id = s.plan_id
ORDER BY s.created_at DESC;

-- 6. Check days remaining for each subscription
SELECT 
  t.name as tenant_name,
  p.name as plan_name,
  s.status,
  CASE 
    WHEN s.trial_ends_at IS NOT NULL THEN 
      EXTRACT(DAY FROM (s.trial_ends_at - NOW()))
    ELSE 
      EXTRACT(DAY FROM (s.current_period_end - NOW()))
  END as days_remaining,
  CASE 
    WHEN s.trial_ends_at IS NOT NULL THEN s.trial_ends_at
    ELSE s.current_period_end
  END as expires_at
FROM subscriptions s
JOIN tenants t ON t.id = s.tenant_id
JOIN plans p ON p.id = s.plan_id
WHERE s.status = 'active'
ORDER BY days_remaining ASC;
