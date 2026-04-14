-- Create prices table for Stripe pricing information
CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY, -- Stripe price ID
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  description TEXT,
  unit_amount BIGINT, -- Price in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  type TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  interval TEXT CHECK (interval IN ('day', 'week', 'month', 'year')),
  interval_count INTEGER,
  trial_period_days INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_active ON prices(active);
CREATE INDEX IF NOT EXISTS idx_prices_type ON prices(type);

-- Enable Row Level Security
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - prices are generally readable by all
CREATE POLICY "Anyone can view active prices" ON prices
  FOR SELECT USING (active = true);

-- Add comments for documentation
COMMENT ON TABLE prices IS 'Stripe pricing information for products';
COMMENT ON COLUMN prices.id IS 'Stripe price ID';
COMMENT ON COLUMN prices.product_id IS 'Associated product ID';
COMMENT ON COLUMN prices.active IS 'Whether the price is active';
COMMENT ON COLUMN prices.unit_amount IS 'Price amount in cents';
COMMENT ON COLUMN prices.currency IS 'Three-letter ISO currency code';
COMMENT ON COLUMN prices.type IS 'one_time or recurring';
COMMENT ON COLUMN prices.interval IS 'Billing interval (for recurring prices)';
COMMENT ON COLUMN prices.interval_count IS 'Number of intervals between billings';
COMMENT ON COLUMN prices.trial_period_days IS 'Trial period in days';