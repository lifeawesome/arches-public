-- Create products table for Stripe products/plans
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, -- Stripe product ID
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - products are generally readable by all authenticated users
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (active = true);

-- Add comments for documentation
COMMENT ON TABLE products IS 'Stripe products/plans for subscription management';
COMMENT ON COLUMN products.id IS 'Stripe product ID';
COMMENT ON COLUMN products.name IS 'Product/plan name';
COMMENT ON COLUMN products.description IS 'Product description';
COMMENT ON COLUMN products.active IS 'Whether the product is active';
COMMENT ON COLUMN products.metadata IS 'Additional product metadata';
