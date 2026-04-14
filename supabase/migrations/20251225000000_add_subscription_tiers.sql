-- Add subscription_tier column to profiles table
-- This allows us to track user tiers independently of Stripe subscriptions

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'explorer' CHECK (subscription_tier IN ('explorer', 'builder', 'pro', 'partner'));

-- Create index for faster tier queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- Add lookup_key column to prices table if it doesn't exist
ALTER TABLE prices
ADD COLUMN IF NOT EXISTS lookup_key TEXT UNIQUE;

-- Create index for faster lookup_key queries
CREATE INDEX IF NOT EXISTS idx_prices_lookup_key ON prices(lookup_key);

-- Add comment explaining the tier system
COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier: explorer (free), builder, pro, or partner';
COMMENT ON COLUMN prices.lookup_key IS 'Stripe price lookup_key for stable price references';









