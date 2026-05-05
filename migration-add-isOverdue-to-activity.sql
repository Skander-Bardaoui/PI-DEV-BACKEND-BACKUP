-- Migration: Add isOverdue and isOnTime fields to activity table
-- These fields mark activities that were completed after/before the due date

-- Add isOverdue column (defaults to false for existing records)
ALTER TABLE activity 
ADD COLUMN IF NOT EXISTS "isOverdue" boolean DEFAULT false;

-- Add isOnTime column (defaults to false for existing records)
ALTER TABLE activity 
ADD COLUMN IF NOT EXISTS "isOnTime" boolean DEFAULT false;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'activity' AND column_name IN ('isOverdue', 'isOnTime');
