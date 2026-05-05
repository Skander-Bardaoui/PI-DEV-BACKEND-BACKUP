-- ============================================================================
-- FIX: Make productId required in quote_items
-- ============================================================================

-- STEP 1: Delete old quote items with NULL productId
DELETE FROM quote_items WHERE "productId" IS NULL;

-- STEP 2: Make productId column NOT NULL
ALTER TABLE quote_items 
ALTER COLUMN "productId" SET NOT NULL;

-- STEP 3: Verify the change
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'quote_items' 
  AND column_name = 'productId';

-- Expected: is_nullable = 'NO'
