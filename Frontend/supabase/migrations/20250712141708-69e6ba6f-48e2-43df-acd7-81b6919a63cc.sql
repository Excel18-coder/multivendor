-- Create storage buckets for product and store images
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('product-images', 'product-images', true),
  ('store-images', 'store-images', true);

-- Create storage policies for product images
CREATE POLICY "Product images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- Create storage policies for store images
CREATE POLICY "Store images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'store-images');

CREATE POLICY "Authenticated users can upload store images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'store-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their store images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'store-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their store images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'store-images' AND auth.uid() IS NOT NULL);