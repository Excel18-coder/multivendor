
-- First, let's update the profiles table to support user roles (buyer/seller)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'buyer' CHECK (user_type IN ('buyer', 'seller'));

-- Update the stores table to ensure proper relationships and add image support
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create wishlist table
CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Create cart table
CREATE TABLE IF NOT EXISTS public.cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Create product comparisons table
CREATE TABLE IF NOT EXISTS public.product_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Update products table to add more fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;

-- Add foreign key relationship for products to stores if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'products_store_id_fkey'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_store_id_fkey 
        FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS policies for wishlist
DROP POLICY IF EXISTS "Users can manage their own wishlist" ON public.wishlist;
CREATE POLICY "Users can manage their own wishlist" ON public.wishlist
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for cart
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart;
CREATE POLICY "Users can manage their own cart" ON public.cart
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for product comparisons
DROP POLICY IF EXISTS "Users can manage their own comparisons" ON public.product_comparisons;
CREATE POLICY "Users can manage their own comparisons" ON public.product_comparisons
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for stores (sellers can manage their own stores)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view active stores" ON public.stores;
CREATE POLICY "Everyone can view active stores" ON public.stores
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Sellers can manage their own stores" ON public.stores;
CREATE POLICY "Sellers can manage their own stores" ON public.stores
  FOR ALL USING (auth.uid() = owner_id);

-- RLS policies for products (sellers can manage their store's products)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view products" ON public.products;
CREATE POLICY "Everyone can view products" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can manage their store products" ON public.products;
CREATE POLICY "Sellers can manage their store products" ON public.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stores 
      WHERE stores.id = products.store_id 
      AND stores.owner_id = auth.uid()
    )
  );

-- Update ratings table to ensure proper relationships
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ratings_store_id_fkey'
    ) THEN
        ALTER TABLE public.ratings 
        ADD CONSTRAINT ratings_store_id_fkey 
        FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
    END IF;
END $$;

-- RLS for ratings
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view ratings" ON public.ratings;
CREATE POLICY "Everyone can view ratings" ON public.ratings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.ratings;
CREATE POLICY "Authenticated users can create ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- We'll create dummy stores without owner references for now
-- Real sellers will create their own stores through the UI
INSERT INTO public.stores (id, name, description, location, delivery_fee, image_url, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Fashion Forward Kenya', 'Premium African fashion and modern designs', 'Nairobi, Kenya', 200, '/placeholder.svg', true),
  ('22222222-2222-2222-2222-222222222222', 'Traditional Threads', 'Authentic Kenyan traditional wear', 'Mombasa, Kenya', 300, '/placeholder.svg', true),
  ('33333333-3333-3333-3333-333333333333', 'Urban Style Hub', 'Contemporary street wear and accessories', 'Kisumu, Kenya', 250, '/placeholder.svg', true)
ON CONFLICT (id) DO NOTHING;

-- Insert some dummy products without the quality field to avoid constraint issues
INSERT INTO public.products (id, name, description, price, image_url, store_id, category, in_stock) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'African Print Dress', 'Beautiful handcrafted African print dress perfect for special occasions', 2500, '/placeholder.svg', '11111111-1111-1111-1111-111111111111', 'dresses', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Maasai Beaded Necklace', 'Traditional Maasai beaded necklace made by local artisans', 800, '/placeholder.svg', '22222222-2222-2222-2222-222222222222', 'jewelry', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Kikoy Beach Shirt', 'Comfortable kikoy material beach shirt', 1200, '/placeholder.svg', '33333333-3333-3333-3333-333333333333', 'shirts', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Kente Print Blazer', 'Professional blazer with traditional Kente print accents', 3500, '/placeholder.svg', '11111111-1111-1111-1111-111111111111', 'shirts', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Leather Sandals', 'Handmade leather sandals with traditional patterns', 1800, '/placeholder.svg', '22222222-2222-2222-2222-222222222222', 'shoes', true),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Ankara Pants', 'Stylish Ankara print pants for everyday wear', 1500, '/placeholder.svg', '33333333-3333-3333-3333-333333333333', 'pants', true)
ON CONFLICT (id) DO NOTHING;
