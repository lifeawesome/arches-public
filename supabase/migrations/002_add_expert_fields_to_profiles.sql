-- Add expert-related fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_expert BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expertise TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
ADD COLUMN IF NOT EXISTS hourly_rate INTEGER,
ADD COLUMN IF NOT EXISTS availability TEXT;

-- Add index for expert filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_expert ON profiles(is_expert);

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_expert IS 'Whether this user is marked as an expert';
COMMENT ON COLUMN profiles.expertise IS 'Area of expertise (e.g., SaaS Development, Growth Marketing)';
COMMENT ON COLUMN profiles.bio IS 'Professional bio for expert profile';
COMMENT ON COLUMN profiles.linkedin_url IS 'LinkedIn profile URL';
COMMENT ON COLUMN profiles.portfolio_url IS 'Portfolio website URL';
COMMENT ON COLUMN profiles.hourly_rate IS 'Hourly rate in USD';
COMMENT ON COLUMN profiles.availability IS 'Availability description';
