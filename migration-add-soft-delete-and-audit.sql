-- Migration: Add Soft Delete and Audit Fields
-- Date: 2026-04-11
-- Description: Adds soft delete functionality and audit tracking fields to stock entities

-- ============================================================
-- 1. Add audit fields to products table
-- ============================================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS created_by UUID NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL,
ADD COLUMN IF NOT EXISTS printed_by UUID NULL,
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ NULL;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_created_by') THEN
        ALTER TABLE products ADD CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_updated_by') THEN
        ALTER TABLE products ADD CONSTRAINT fk_products_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_deleted_by') THEN
        ALTER TABLE products ADD CONSTRAINT fk_products_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_printed_by') THEN
        ALTER TABLE products ADD CONSTRAINT fk_products_printed_by FOREIGN KEY (printed_by) REFERENCES users(id);
    END IF;
END $$;

-- ============================================================
-- 2. Add audit fields to product_categories table
-- ============================================================
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS created_by UUID NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_product_categories_deleted_at ON product_categories(deleted_at);

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_categories_created_by') THEN
        ALTER TABLE product_categories ADD CONSTRAINT fk_product_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_categories_updated_by') THEN
        ALTER TABLE product_categories ADD CONSTRAINT fk_product_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_categories_deleted_by') THEN
        ALTER TABLE product_categories ADD CONSTRAINT fk_product_categories_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
    END IF;
END $$;

-- ============================================================
-- 3. Add audit fields to stock_movements table
-- ============================================================
ALTER TABLE stock_movements
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_deleted_at ON stock_movements(deleted_at);

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_movements_deleted_by') THEN
        ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
    END IF;
END $$;

-- ============================================================
-- 4. Create audit_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  entity_name VARCHAR(255) NULL,
  performed_by UUID NOT NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  description TEXT NULL,
  metadata JSONB NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints for audit_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_business') THEN
        ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_performed_by') THEN
        ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_performed_by FOREIGN KEY (performed_by) REFERENCES users(id);
    END IF;
END $$;

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created ON audit_logs(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at);

-- ============================================================
-- Migration Complete
-- ============================================================
-- Run this script using: psql -U <username> -d <database> -f migration-add-soft-delete-and-audit.sql
