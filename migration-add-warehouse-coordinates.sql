-- Migration: Add latitude and longitude to warehouses table
-- This enables storing precise GPS coordinates for warehouse locations

-- Add latitude column
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);

-- Add longitude column
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Add comments to document the columns
COMMENT ON COLUMN warehouses.latitude IS 'GPS latitude coordinate (e.g., 36.8065 for Tunis)';
COMMENT ON COLUMN warehouses.longitude IS 'GPS longitude coordinate (e.g., 10.1815 for Tunis)';

-- Optional: Add index for geospatial queries (if needed in the future)
-- CREATE INDEX idx_warehouses_coordinates ON warehouses(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
