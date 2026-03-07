
-- First, let's clean up all existing data and fix the database structure
TRUNCATE TABLE public.cart CASCADE;
TRUNCATE TABLE public.wishlist CASCADE;
TRUNCATE TABLE public.product_comparisons CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.store_follows CASCADE;
TRUNCATE TABLE public.ratings CASCADE;
TRUNCATE TABLE public.complaints CASCADE;
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.stores CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- Create storage buckets for product and store images
INSERT INTO storage.buckets (id, name, public) VALUES 
('product-images', 'product-images', true),
('store-images', 'store-images', true);

-- Create storage policies for product images
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their product images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for store images
CREATE POLICY "Anyone can view store images" ON storage.objects FOR SELECT USING (bucket_id = 'store-images');
CREATE POLICY "Authenticated users can upload store images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their store images" ON storage.objects FOR UPDATE USING (bucket_id = 'store-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their store images" ON storage.objects FOR DELETE USING (bucket_id = 'store-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Fix the profiles table to properly handle user_type during signup
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check CHECK (user_type IN ('buyer', 'seller'));

-- Update the handle_new_user function to properly set user_type from metadata
DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, user_type)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'buyer')
  );
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add account deletion function
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete user's data in order (respecting foreign keys)
  DELETE FROM public.cart WHERE user_id = auth.uid();
  DELETE FROM public.wishlist WHERE user_id = auth.uid();
  DELETE FROM public.product_comparisons WHERE user_id = auth.uid();
  DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid());
  DELETE FROM public.orders WHERE user_id = auth.uid();
  DELETE FROM public.store_follows WHERE user_id = auth.uid();
  DELETE FROM public.ratings WHERE buyer_id = auth.uid();
  
  -- Delete products from user's stores
  DELETE FROM public.products WHERE store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid());
  
  -- Delete user's stores
  DELETE FROM public.stores WHERE owner_id = auth.uid();
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = auth.uid();
  
  -- Delete auth user (this will cascade)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Insert sample data for testing
-- Insert profiles (these will be created automatically by the trigger, but we'll insert some manual ones for testing)
INSERT INTO public.profiles (id, email, full_name, user_type) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'seller1@example.com', 'Fashion Designer', 'seller'),
('550e8400-e29b-41d4-a716-446655440001', 'seller2@example.com', 'Craft Artisan', 'seller'),
('550e8400-e29b-41d4-a716-446655440002', 'seller3@example.com', 'Tech Vendor', 'seller');

-- Insert stores with diverse categories
INSERT INTO public.stores (id, name, description, location, delivery_fee, image_url, store_type, owner_id, is_active) VALUES
('650e8400-e29b-41d4-a716-446655440000', 'Nairobi Fashion Hub', 'Premium African fashion and modern clothing', 'Nairobi CBD', 200, '/placeholder.svg', 'Fashion & Apparel', '550e8400-e29b-41d4-a716-446655440000', true),
('650e8400-e29b-41d4-a716-446655440001', 'Heritage Crafts', 'Authentic Kenyan traditional crafts and jewelry', 'Karen', 150, '/placeholder.svg', 'Traditional Crafts', '550e8400-e29b-41d4-a716-446655440001', true),
('650e8400-e29b-41d4-a716-446655440002', 'Tech Solutions Kenya', 'Latest gadgets and tech accessories', 'Westlands', 300, '/placeholder.svg', 'Tech & Gadgets', '550e8400-e29b-41d4-a716-446655440002', true),
('650e8400-e29b-41d4-a716-446655440003', 'Coastal Styles', 'Beachwear and coastal fashion', 'Mombasa', 250, '/placeholder.svg', 'Fashion & Apparel', '550e8400-e29b-41d4-a716-446655440000', true),
('650e8400-e29b-41d4-a716-446655440004', 'Home & Living', 'Furniture and home decor', 'Nakuru', 400, '/placeholder.svg', 'Furniture & Home', '550e8400-e29b-41d4-a716-446655440001', true),
('650e8400-e29b-41d4-a716-446655440005', 'Beauty Corner', 'Cosmetics and beauty products', 'Kisumu', 180, '/placeholder.svg', 'Health & Beauty', '550e8400-e29b-41d4-a716-446655440002', true);

-- Insert diverse products with proper tags
INSERT INTO public.products (id, name, description, price, quality, image_url, category, tags, store_id, in_stock) VALUES
-- Fashion products
('750e8400-e29b-41d4-a716-446655440000', 'African Print Dress', 'Beautiful Ankara dress with modern cut', 2500, 'premium', '/placeholder.svg', 'dresses', ARRAY['african', 'print', 'dress', 'ankara', 'fashion'], '650e8400-e29b-41d4-a716-446655440000', true),
('750e8400-e29b-41d4-a716-446655440001', 'Cotton Shirt', 'Comfortable cotton shirt for everyday wear', 800, 'basic', '/placeholder.svg', 'shirts', ARRAY['cotton', 'shirt', 'casual', 'comfort'], '650e8400-e29b-41d4-a716-446655440000', true),
('750e8400-e29b-41d4-a716-446655440002', 'Leather Sandals', 'Handcrafted leather sandals', 1200, 'premium', '/placeholder.svg', 'shoes', ARRAY['leather', 'sandals', 'handcrafted', 'shoes'], '650e8400-e29b-41d4-a716-446655440003', true),
('750e8400-e29b-41d4-a716-446655440003', 'Denim Jeans', 'High-quality denim jeans', 1800, 'premium', '/placeholder.svg', 'pants', ARRAY['denim', 'jeans', 'pants', 'fashion'], '650e8400-e29b-41d4-a716-446655440000', true),

-- Traditional crafts
('750e8400-e29b-41d4-a716-446655440004', 'Maasai Beaded Jewelry', 'Traditional Maasai beaded necklace', 1200, 'luxury', '/placeholder.svg', 'jewelry', ARRAY['maasai', 'beaded', 'jewelry', 'traditional', 'necklace'], '650e8400-e29b-41d4-a716-446655440001', true),
('750e8400-e29b-41d4-a716-446655440005', 'Kikoy Scarf', 'Traditional Kikoy fabric scarf', 600, 'basic', '/placeholder.svg', 'accessories', ARRAY['kikoy', 'scarf', 'traditional', 'fabric'], '650e8400-e29b-41d4-a716-446655440001', true),
('750e8400-e29b-41d4-a716-446655440006', 'Wooden Carving', 'Hand-carved wooden sculpture', 3000, 'luxury', '/placeholder.svg', 'art', ARRAY['wooden', 'carving', 'sculpture', 'art', 'handmade'], '650e8400-e29b-41d4-a716-446655440001', true),

-- Tech products
('750e8400-e29b-41d4-a716-446655440007', 'Wireless Earbuds', 'Bluetooth wireless earbuds', 4500, 'premium', '/placeholder.svg', 'electronics', ARRAY['wireless', 'earbuds', 'bluetooth', 'tech', 'audio'], '650e8400-e29b-41d4-a716-446655440002', true),
('750e8400-e29b-41d4-a716-446655440008', 'Phone Case', 'Protective phone case', 800, 'basic', '/placeholder.svg', 'accessories', ARRAY['phone', 'case', 'protective', 'tech', 'mobile'], '650e8400-e29b-41d4-a716-446655440002', true),
('750e8400-e29b-41d4-a716-446655440009', 'Laptop Stand', 'Adjustable laptop stand', 2200, 'premium', '/placeholder.svg', 'accessories', ARRAY['laptop', 'stand', 'adjustable', 'tech', 'ergonomic'], '650e8400-e29b-41d4-a716-446655440002', true),

-- Home products
('750e8400-e29b-41d4-a716-446655440010', 'Cushion Cover', 'Decorative cushion cover', 1000, 'basic', '/placeholder.svg', 'home', ARRAY['cushion', 'cover', 'decorative', 'home', 'interior'], '650e8400-e29b-41d4-a716-446655440004', true),
('750e8400-e29b-41d4-a716-446655440011', 'Table Lamp', 'Modern table lamp', 3500, 'premium', '/placeholder.svg', 'lighting', ARRAY['table', 'lamp', 'modern', 'lighting', 'home'], '650e8400-e29b-41d4-a716-446655440004', true),

-- Beauty products
('750e8400-e29b-41d4-a716-446655440012', 'Skincare Set', 'Natural skincare set', 2800, 'premium', '/placeholder.svg', 'beauty', ARRAY['skincare', 'set', 'natural', 'beauty', 'care'], '650e8400-e29b-41d4-a716-446655440005', true),
('750e8400-e29b-41d4-a716-446655440013', 'Lip Balm', 'Moisturizing lip balm', 400, 'basic', '/placeholder.svg', 'beauty', ARRAY['lip', 'balm', 'moisturizing', 'beauty', 'care'], '650e8400-e29b-41d4-a716-446655440005', true);
