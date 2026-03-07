
-- Clean migration avoiding conflicts
-- Drop existing conflicting policies first
DROP POLICY IF EXISTS "Users can manage their own cart" ON cart;
DROP POLICY IF EXISTS "Users can manage their own wishlist" ON wishlist;
DROP POLICY IF EXISTS "Users can manage their own comparisons" ON product_comparisons;

-- Add foreign key constraints that might be missing (with IF NOT EXISTS equivalent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_products_store_id') THEN
        ALTER TABLE products ADD CONSTRAINT fk_products_store_id FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_cart_user_id') THEN
        ALTER TABLE cart ADD CONSTRAINT fk_cart_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_cart_product_id') THEN
        ALTER TABLE cart ADD CONSTRAINT fk_cart_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_wishlist_user_id') THEN
        ALTER TABLE wishlist ADD CONSTRAINT fk_wishlist_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_wishlist_product_id') THEN
        ALTER TABLE wishlist ADD CONSTRAINT fk_wishlist_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create table for store follows
CREATE TABLE IF NOT EXISTS store_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Create table for orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  shipping_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE store_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Store follows policies
CREATE POLICY "Users can view their own store follows" ON store_follows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own store follows" ON store_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own store follows" ON store_follows FOR DELETE USING (auth.uid() = user_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Order items policies
CREATE POLICY "Users can view their order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Users can create order items for their orders" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- Recreate cart, wishlist, and comparison policies
CREATE POLICY "Users can manage their own cart_items" ON cart FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own wishlist_items" ON wishlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own product_comparisons" ON product_comparisons FOR ALL USING (auth.uid() = user_id);

-- Add constraint to ensure sellers can only have one store
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_owner_store') THEN
        ALTER TABLE stores ADD CONSTRAINT unique_owner_store UNIQUE (owner_id);
    END IF;
END $$;
