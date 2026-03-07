
-- First, let's see what the current quality check constraint allows
-- and update it to be more flexible, then add the tags column

-- Drop the existing quality check constraint if it exists
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_quality_check;

-- Add a new, more flexible quality check constraint
ALTER TABLE public.products ADD CONSTRAINT products_quality_check 
CHECK (quality IN ('basic', 'premium', 'luxury'));

-- Add tags column for product searching and comparison
ALTER TABLE public.products ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Add a not-null constraint for tags to make it compulsory
ALTER TABLE public.products ALTER COLUMN tags SET NOT NULL;

-- Update existing products to have default tags if they don't have any
UPDATE public.products SET tags = ARRAY[LOWER(category)] WHERE tags = '{}' OR tags IS NULL;
