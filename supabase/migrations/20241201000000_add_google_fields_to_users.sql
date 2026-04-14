-- Add OAuth specific fields to profiles table
-- Note: We can't modify auth.users directly, so we store OAuth data in profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS google_id TEXT,
ADD COLUMN IF NOT EXISTS linkedin_id TEXT,
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS last_sign_in TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS given_name TEXT,
ADD COLUMN IF NOT EXISTS family_name TEXT,
ADD COLUMN IF NOT EXISTS locale TEXT;

-- Create indexes for OAuth IDs for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON profiles(google_id);
CREATE INDEX IF NOT EXISTS idx_profiles_linkedin_id ON profiles(linkedin_id);

-- Create index for provider for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);

-- Add comment to document the new fields
COMMENT ON COLUMN profiles.google_id IS 'Google OAuth user ID (sub field)';
COMMENT ON COLUMN profiles.linkedin_id IS 'LinkedIn OAuth user ID (sub field)';
COMMENT ON COLUMN profiles.provider IS 'Authentication provider (email, google, linkedin)';
COMMENT ON COLUMN profiles.last_sign_in IS 'Last sign in timestamp';
COMMENT ON COLUMN profiles.email_verified IS 'Whether email is verified by OAuth provider';
COMMENT ON COLUMN profiles.given_name IS 'First name from OAuth provider';
COMMENT ON COLUMN profiles.family_name IS 'Last name from OAuth provider';
COMMENT ON COLUMN profiles.locale IS 'User locale from OAuth provider';
