
-- Fix products that are showing as out of stock by updating them to be in stock
UPDATE products 
SET in_stock = true 
WHERE in_stock = false OR in_stock IS NULL;

-- Add a function to properly count store followers that updates in real-time
CREATE OR REPLACE FUNCTION get_store_followers_count(store_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM store_follows
  WHERE store_id = store_uuid;
$$;

-- Add username field to complaints table to show who made the complaint
ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create a view to easily get complaints with usernames
CREATE OR REPLACE VIEW public.complaints_with_usernames AS
SELECT 
  c.id,
  c.store_id,
  c.message,
  c.submitted_at,
  c.user_id,
  COALESCE(c.username, p.full_name, 'Anonymous') as username
FROM complaints c
LEFT JOIN profiles p ON c.user_id = p.id;

-- Enable RLS on the complaints view (anyone can view complaints for stores)
CREATE POLICY "Anyone can view complaints with usernames"
ON complaints_with_usernames
FOR SELECT
TO public
USING (true);
