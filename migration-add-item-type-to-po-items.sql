-- Migration: Add item_type column to supplier_po_items table
-- This allows purchase orders to support both products and services

-- Add item_type column with default value 'PRODUCT'
ALTER TABLE supplier_po_items 
ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'PRODUCT';

-- Add check constraint to ensure only valid values
ALTER TABLE supplier_po_items 
ADD CONSTRAINT chk_item_type CHECK (item_type IN ('PRODUCT', 'SERVICE'));

-- Update existing records to have 'PRODUCT' as item_type
UPDATE supplier_po_items 
SET item_type = 'PRODUCT' 
WHERE item_type IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN supplier_po_items.item_type IS 'Type of item: PRODUCT for physical products, SERVICE for services';
