-- Add 'card' to the payment method enum
-- This allows Stripe card payments to be recorded in the database

-- Check current enum values
SELECT enum_range(NULL::payments_method_enum);

-- Add 'card' to the enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'card' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payments_method_enum')
    ) THEN
        ALTER TYPE payments_method_enum ADD VALUE 'card';
    END IF;
END$$;

-- Verify the change
SELECT enum_range(NULL::payments_method_enum);
