-- Create admin_settings table for featured products and settings
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only (for now, we'll make it accessible to all authenticated users)
CREATE POLICY "Authenticated users can manage admin settings" 
ON public.admin_settings 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Add support for multiple images in products table
ALTER TABLE public.products 
ADD COLUMN image_urls TEXT[] DEFAULT '{}';

-- Update existing products to include their current image_url in the array
UPDATE public.products 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '';

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_settings_updated_at();