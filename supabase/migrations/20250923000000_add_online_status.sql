-- Add last_seen_at field to profiles for online status tracking
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient online status queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at);

-- Add comment for documentation
COMMENT ON COLUMN profiles.last_seen_at IS 'Timestamp of last user activity for online status indicator';

-- Create a function to update last_seen_at
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger to auto-update last_seen_at will be added via application logic
-- to avoid updating on every profile update (which would be too frequent)

