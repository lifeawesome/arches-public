-- Add onboarding fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';

-- Create index for onboarding status for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON profiles(onboarding_completed);

-- Add comment to document the new fields
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed the onboarding process';
COMMENT ON COLUMN profiles.onboarding_step IS 'Current step in onboarding process (0 = not started)';
COMMENT ON COLUMN profiles.onboarding_data IS 'JSON data collected during onboarding process';
