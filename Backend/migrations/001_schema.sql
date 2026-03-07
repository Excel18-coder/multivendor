-- ============================================================
-- Multivendor SaaS Ecommerce - Full Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    full_name   TEXT,
    role        TEXT NOT NULL DEFAULT 'user',     -- 'user' | 'admin'
    user_type   TEXT NOT NULL DEFAULT 'buyer',    -- 'buyer' | 'seller'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    name                 TEXT,
    description          TEXT,
    location             TEXT,
    image_url            TEXT,
    slug                 TEXT UNIQUE,
    store_type           TEXT,
    payment_options      TEXT[] DEFAULT ARRAY['POD'],
    is_active            BOOLEAN DEFAULT TRUE,
    delivery_fee         NUMERIC(10,2) DEFAULT 0,
    whatsapp_phone       TEXT,
    -- M-Pesa fields
    mpesa_enabled        BOOLEAN DEFAULT FALSE,
    mpesa_type           TEXT,                    -- 'till' | 'paybill' | 'bank'
    mpesa_number         TEXT,
    mpesa_account_number TEXT,
    mpesa_bank_name      TEXT,
    mpesa_api_key        TEXT,
    mpesa_status         TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    mpesa_approved_at    TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id            UUID REFERENCES stores(id) ON DELETE CASCADE,
    name                TEXT,
    description         TEXT,
    price               NUMERIC(12,2),
    category            TEXT,
    quality             TEXT,
    image_url           TEXT,
    image_urls          TEXT[],
    in_stock            BOOLEAN DEFAULT TRUE,
    tags                TEXT[] DEFAULT '{}',
    discount_percentage NUMERIC(5,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_store_id    ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_in_stock    ON products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm   ON products USING GIN (name gin_trgm_ops);

-- ============================================================
-- CART
-- ============================================================
CREATE TABLE IF NOT EXISTS cart (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity   INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);

-- ============================================================
-- WISHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlist (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status           TEXT DEFAULT 'pending',   -- 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled'
    total_amount     NUMERIC(12,2),
    shipping_address TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity   INTEGER NOT NULL,
    price      NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- STORE FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS store_follows (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
    store_id   UUID REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_follows_store_id ON store_follows(store_id);
CREATE INDEX IF NOT EXISTS idx_store_follows_user_id  ON store_follows(user_id);

-- ============================================================
-- RATINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    store_id   UUID REFERENCES stores(id) ON DELETE CASCADE,
    rating     NUMERIC(3,1),
    comment    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ratings_store_id ON ratings(store_id);

-- ============================================================
-- COMPLAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    store_id     UUID REFERENCES stores(id) ON DELETE CASCADE,
    message      TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_store_id ON complaints(store_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id              UUID REFERENCES profiles(id) ON DELETE CASCADE,
    plan                   TEXT,           -- 'free' | 'basic' | 'pro'
    status                 TEXT DEFAULT 'active',
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCT COMPARISONS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_comparisons (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- ============================================================
-- MPESA PAYMENT REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS mpesa_payment_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id             UUID REFERENCES stores(id) ON DELETE SET NULL,
    user_id              UUID REFERENCES profiles(id) ON DELETE SET NULL,
    phone_number         TEXT NOT NULL,
    amount               NUMERIC(12,2) NOT NULL,
    external_reference   TEXT UNIQUE,
    transaction_reference TEXT,
    mpesa_receipt_number  TEXT,
    status               TEXT DEFAULT 'pending',  -- 'pending'|'success'|'failed'
    result_desc          TEXT,
    metadata             JSONB,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_store_id   ON mpesa_payment_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_ext_ref    ON mpesa_payment_requests(external_reference);

-- ============================================================
-- ADMIN SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_settings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key   TEXT UNIQUE NOT NULL,
    setting_value JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default admin settings
INSERT INTO admin_settings (setting_key, setting_value)
VALUES
    ('featured_products',   '{"product_ids": []}'),
    ('top_selling_products','{"product_ids": []}')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Calculate average store rating
CREATE OR REPLACE FUNCTION calculate_store_rating(store_id_param UUID)
RETURNS NUMERIC AS $$
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 3.0)
    FROM ratings
    WHERE store_id = store_id_param;
$$ LANGUAGE SQL STABLE;

-- Generate unique store slug
CREATE OR REPLACE FUNCTION generate_store_slug(store_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter   INTEGER := 0;
BEGIN
    base_slug := LOWER(REGEXP_REPLACE(TRIM(store_name), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := TRIM(BOTH '-' FROM base_slug);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM stores WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_stores_updated_at
    BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_mpesa_updated_at
    BEFORE UPDATE ON mpesa_payment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
