-- Update RLS policy for store_follows to allow viewing all follows for count
DROP POLICY IF EXISTS "Users can view their own store follows" ON store_follows;

CREATE POLICY "Everyone can view store follows for counting" 
ON store_follows 
FOR SELECT 
USING (true);

-- Ensure complaint messages can be viewed by store owners
DROP POLICY IF EXISTS "Anyone can view complaints" ON complaints;

CREATE POLICY "Store owners can view complaints about their stores" 
ON complaints 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM stores 
    WHERE stores.id = complaints.store_id 
    AND stores.owner_id = auth.uid()
  ) 
  OR true  -- Keep public access for complaint counts
);