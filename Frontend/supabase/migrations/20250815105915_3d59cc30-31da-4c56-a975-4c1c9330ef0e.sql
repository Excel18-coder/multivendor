-- Add unique constraint to store names and add slug field
ALTER TABLE public.stores 
ADD COLUMN slug text UNIQUE;

-- Create function to generate URL-friendly slug from store name
CREATE OR REPLACE FUNCTION public.generate_store_slug(store_name text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(trim(store_name), '[^a-zA-Z0-9\s-]', '', 'g')) -- Remove special chars
         |> regexp_replace('\s+', '-', 'g') -- Replace spaces with hyphens
         |> regexp_replace('-+', '-', 'g'); -- Remove multiple consecutive hyphens
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to calculate store rating based on follows and complaints
CREATE OR REPLACE FUNCTION public.calculate_store_rating(store_id_param uuid)
RETURNS numeric AS $$
DECLARE
  follows_count integer;
  complaints_count integer;
  base_rating numeric := 3.0; -- Starting rating
  follow_weight numeric := 0.1; -- Each follow adds 0.1
  complaint_weight numeric := 0.2; -- Each complaint subtracts 0.2
  final_rating numeric;
BEGIN
  -- Get follows count
  SELECT COUNT(*) INTO follows_count
  FROM public.store_follows
  WHERE store_id = store_id_param;
  
  -- Get complaints count
  SELECT COUNT(*) INTO complaints_count
  FROM public.complaints
  WHERE store_id = store_id_param;
  
  -- Calculate final rating
  final_rating := base_rating + (follows_count * follow_weight) - (complaints_count * complaint_weight);
  
  -- Ensure rating stays between 1.0 and 5.0
  final_rating := GREATEST(1.0, LEAST(5.0, final_rating));
  
  RETURN ROUND(final_rating, 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create trigger to auto-generate slug when store is created or name is updated
CREATE OR REPLACE FUNCTION public.set_store_slug()
RETURNS trigger AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Generate base slug from name
  base_slug := public.generate_store_slug(NEW.name);
  final_slug := base_slug;
  
  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_store_slug
  BEFORE INSERT OR UPDATE OF name ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_store_slug();

-- Update existing stores to have slugs
UPDATE public.stores 
SET name = COALESCE(name, 'store-' || EXTRACT(EPOCH FROM created_at)::text)
WHERE name IS NULL;

UPDATE public.stores 
SET slug = public.generate_store_slug(name)
WHERE slug IS NULL;