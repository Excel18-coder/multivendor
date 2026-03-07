-- Add payment_options column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_options TEXT[] DEFAULT ARRAY['POD']::TEXT[];

-- Update existing stores to have POD as default
UPDATE stores SET payment_options = ARRAY['POD']::TEXT[] WHERE payment_options IS NULL;