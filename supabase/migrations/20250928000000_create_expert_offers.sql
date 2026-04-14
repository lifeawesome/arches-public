-- Create expert_offers table for expert service offerings
CREATE TABLE IF NOT EXISTS expert_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  
  -- Offer details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT, -- optional product/service image
  deliverables TEXT[] NOT NULL DEFAULT '{}',
  
  -- Pricing (both options available)
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('fixed', 'hourly', 'both')),
  fixed_price NUMERIC(10, 2), -- in USD
  hourly_rate NUMERIC(10, 2), -- in USD
  estimated_hours INTEGER,
  
  -- Timeline
  estimated_delivery_days INTEGER NOT NULL,
  
  -- Requirements & matching
  required_skills TEXT[] DEFAULT '{}',
  prerequisites TEXT[] DEFAULT '{}',
  expertise_category TEXT,
  
  -- Status & visibility
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expert_offers_expert_id ON expert_offers(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_offers_active ON expert_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_expert_offers_skills ON expert_offers USING GIN(required_skills);
CREATE INDEX IF NOT EXISTS idx_expert_offers_category ON expert_offers(expertise_category);
CREATE INDEX IF NOT EXISTS idx_expert_offers_display_order ON expert_offers(expert_id, display_order);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_expert_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_expert_offers_updated_at
  BEFORE UPDATE ON expert_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_expert_offers_updated_at();

-- Enable Row Level Security
ALTER TABLE expert_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view active offers
CREATE POLICY "Anyone can view active offers" ON expert_offers
  FOR SELECT 
  USING (is_active = true);

-- RLS Policy: Experts can view all their own offers (active and inactive)
CREATE POLICY "Experts can view own offers" ON expert_offers
  FOR SELECT
  USING (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Experts can insert their own offers
CREATE POLICY "Experts can insert own offers" ON expert_offers
  FOR INSERT
  WITH CHECK (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Experts can update their own offers
CREATE POLICY "Experts can update own offers" ON expert_offers
  FOR UPDATE
  USING (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Experts can delete their own offers
CREATE POLICY "Experts can delete own offers" ON expert_offers
  FOR DELETE
  USING (
    expert_id IN (
      SELECT id FROM experts WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE expert_offers IS 'Service offerings created by experts that can be matched with work requests';
COMMENT ON COLUMN expert_offers.pricing_type IS 'Type of pricing: fixed (one-time price), hourly (rate per hour), or both (client can choose)';
COMMENT ON COLUMN expert_offers.fixed_price IS 'Fixed price in USD for the entire service';
COMMENT ON COLUMN expert_offers.hourly_rate IS 'Hourly rate in USD';
COMMENT ON COLUMN expert_offers.estimated_hours IS 'Estimated hours needed (used with hourly pricing)';
COMMENT ON COLUMN expert_offers.deliverables IS 'Array of deliverable items included in this offer';
COMMENT ON COLUMN expert_offers.required_skills IS 'Skills required or showcased in this offer (used for AI matching)';
COMMENT ON COLUMN expert_offers.prerequisites IS 'Prerequisites or requirements from the client';
COMMENT ON COLUMN expert_offers.display_order IS 'Order in which offers should be displayed (lower numbers first)';

