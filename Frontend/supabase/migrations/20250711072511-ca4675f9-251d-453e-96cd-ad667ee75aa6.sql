-- Add foreign key relationship between complaints and profiles
ALTER TABLE public.complaints 
ADD CONSTRAINT complaints_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;