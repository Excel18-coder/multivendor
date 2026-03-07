
-- Check if stores table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
        CREATE TABLE public.stores (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          owner_id uuid REFERENCES auth.users NOT NULL,
          name text NOT NULL,
          description text,
          location text,
          delivery_fee numeric DEFAULT 0,
          created_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- Check if products table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        CREATE TABLE public.products (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          store_id uuid REFERENCES public.stores NOT NULL,
          name text NOT NULL,
          description text,
          price numeric NOT NULL,
          quality text CHECK (quality IN ('basic', 'premium', 'luxury')),
          image_url text,
          created_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- Check if ratings table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings') THEN
        CREATE TABLE public.ratings (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          store_id uuid REFERENCES public.stores NOT NULL,
          buyer_id uuid REFERENCES auth.users NOT NULL,
          rating integer CHECK (rating >= 1 AND rating <= 5),
          comment text,
          created_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- Check if subscriptions table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        CREATE TABLE public.subscriptions (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          seller_id uuid REFERENCES auth.users NOT NULL,
          plan text DEFAULT 'basic' CHECK (plan IN ('basic', 'premium', 'enterprise')),
          status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
          stripe_customer_id text,
          stripe_subscription_id text,
          created_at timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Stores policies
DROP POLICY IF EXISTS "Anyone can view stores" ON public.stores;
CREATE POLICY "Anyone can view stores" ON public.stores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can create stores" ON public.stores;
CREATE POLICY "Sellers can create stores" ON public.stores FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Sellers can update own stores" ON public.stores;
CREATE POLICY "Sellers can update own stores" ON public.stores FOR UPDATE USING (auth.uid() = owner_id);

-- Products policies
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;
CREATE POLICY "Store owners can manage products" ON public.products FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Store owners can update products" ON public.products;
CREATE POLICY "Store owners can update products" ON public.products FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Store owners can delete products" ON public.products;
CREATE POLICY "Store owners can delete products" ON public.products FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
);

-- Ratings policies
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.ratings;
CREATE POLICY "Authenticated users can create ratings" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Complaints policies (allow anonymous submissions)
DROP POLICY IF EXISTS "Anyone can submit complaints" ON public.complaints;
CREATE POLICY "Anyone can submit complaints" ON public.complaints FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view complaints" ON public.complaints;
CREATE POLICY "Anyone can view complaints" ON public.complaints FOR SELECT USING (true);

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can manage own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = seller_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
