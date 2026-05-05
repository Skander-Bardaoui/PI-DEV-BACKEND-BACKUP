-- Migration: Make productId required in sales_order_items
-- This ensures stock movements can be created for all sales orders

-- Step 1: First, let's see how many rows have NULL productId
SELECT COUNT(*) as null_count 
FROM sales_order_items 
WHERE "productId" IS NULL;

-- Step 2: Update existing NULL values to a placeholder (OPTIONAL - only if you want to keep old data)
-- WARNING: This will link old orders to a dummy product. Skip this if you want to delete old orders instead.
-- UPDATE sales_order_items 
-- SET "productId" = 'YOUR_PLACEHOLDER_PRODUCT_ID'
-- WHERE "productId" IS NULL;

-- Step 3: OR Delete old orders with NULL productId (RECOMMENDED)
-- This removes all sales orders that don't have products selected
DELETE FROM sales_order_items WHERE "productId" IS NULL;

-- Step 4: Make the column NOT NULL
ALTER TABLE sales_order_items 
ALTER COLUMN "productId" SET NOT NULL;

-- Step 5: Verify the change
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'sales_order_items' 
  AND column_name = 'productId';

-- Expected result: is_nullable = 'NO'
