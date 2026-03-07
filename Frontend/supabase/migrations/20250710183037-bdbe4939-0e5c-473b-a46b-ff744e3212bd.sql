
-- Add user_id column to complaints table to track who submitted each complaint
ALTER TABLE public.complaints 
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Update the RLS policy to allow users to see all complaints but only create their own
DROP POLICY IF EXISTS "Anyone can submit complaints" ON public.complaints;
DROP POLICY IF EXISTS "Anyone can view complaints" ON public.complaints;

-- Create new policies
CREATE POLICY "Anyone can view complaints" 
  ON public.complaints 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can submit complaints" 
  ON public.complaints 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
