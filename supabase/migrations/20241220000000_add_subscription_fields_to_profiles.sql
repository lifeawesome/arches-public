-- Add subscription fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id ON profiles(plan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_next_billing_date ON profiles(next_billing_date);

-- Add foreign key constraint for plan_id to link to products table
-- First check if constraint already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_plan_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles 
        ADD CONSTRAINT profiles_plan_id_fkey 
        FOREIGN KEY (plan_id) REFERENCES products(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add comments to document the new fields
COMMENT ON COLUMN profiles.subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN profiles.plan_id IS 'Product/plan ID from Stripe';
COMMENT ON COLUMN profiles.subscription_status IS 'Current subscription status (active, canceled, past_due, etc.)';
COMMENT ON COLUMN profiles.next_billing_date IS 'Next billing date for subscription';
COMMENT ON COLUMN profiles.current_period_start IS 'Start of current billing period';
COMMENT ON COLUMN profiles.current_period_end IS 'End of current billing period';
