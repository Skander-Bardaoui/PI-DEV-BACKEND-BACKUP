-- ============================================================================
-- CRITICAL FIX: Make productId required in sales_order_items
-- ============================================================================
-- This will:
-- 1. Delete all old sales orders with NULL productId
-- 2. Make productId column NOT NULL (required)
-- 3. Prevent future orders without products
-- ============================================================================

-- STEP 1: Delete old sales order items with NULL productId
-- (This will cascade delete the parent sales orders)
DELETE FROM sales_order_items WHERE "productId" IS NULL;

-- STEP 2: Make productId column NOT NULL
ALTER TABLE sales_order_items 
ALTER COLUMN "productId" SET NOT NULL;

-- STEP 3: Verify the change
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_order_items' 
  AND column_name = 'productId';

-- Expected: is_nullable = 'NO'

-- DONE! Now the database will reject any attempt to insert NULL productId
