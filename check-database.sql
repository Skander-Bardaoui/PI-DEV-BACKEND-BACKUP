-- Quick Database Check Script
-- Run this to see what tables exist and their data

-- 1. Check if plans table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans')
    THEN '✅ Plans table EXISTS'
    ELSE '❌ Plans table MISSING - Run create-plans-table.sql'
  END as plans_table_status;

-- 2. Check if payments table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments')
    THEN '✅ Payments table EXISTS'
    ELSE '❌ Payments table MISSING - Run create-plans-table.sql'
  END as payments_table_status;

-- 3. Check if subscriptions has payment_token column
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'subscriptions' AND column_name = 'payment_token'
    )
    THEN '✅ Subscriptions.payment_token EXISTS'
    ELSE '❌ Subscriptions.payment_token MISSING - Run create-plans-table.sql'
  END as payment_token_status;

-- 4. Count plans (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans') THEN
    RAISE NOTICE '--- PLANS COUNT ---';
    PERFORM * FROM (SELECT COUNT(*) as total_plans FROM plans) as count_result;
  END IF;
END $$;

-- 5. Show all plans (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans') THEN
    RAISE NOTICE '--- ALL PLANS ---';
  END IF;
END $$;

SELECT 
  id,
  name,
  slug,
  price_monthly,
  price_annual,
  max_users,
  max_businesses,
  is_active,
  created_at
FROM plans
ORDER BY price_monthly ASC;

-- 6. Show subscription status enum values
SELECT 
  enumlabel as subscription_status_values
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_status')
ORDER BY enumsortorder;

-- 7. Count subscriptions by status
SELECT 
  status,
  COUNT(*) as count
FROM subscriptions
GROUP BY status
ORDER BY count DESC;

-- 8. Show recent subscriptions
SELECT 
  id,
  tenant_id,
  plan_id,
  status,
  billing_cycle,
  created_at
FROM subscriptions
ORDER BY created_at DESC
LIMIT 5;
