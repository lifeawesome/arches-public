-- Add stripe_customer_id column to profiles table
-- This allows us to quickly access the Stripe customer ID for billing portal access

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Add comment explaining the field
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for billing portal access';

-- Backfill stripe_customer_id from subscriptions metadata for existing users
UPDATE profiles
SET stripe_customer_id = (
  SELECT metadata->>'stripe_customer_id'
  FROM subscriptions
  WHERE subscriptions.user_id = profiles.id
  AND subscriptions.status = 'active'
  LIMIT 1
)
WHERE stripe_customer_id IS NULL
AND EXISTS (
  SELECT 1 
  FROM subscriptions 
  WHERE subscriptions.user_id = profiles.id 
  AND subscriptions.metadata->>'stripe_customer_id' IS NOT NULL
);









