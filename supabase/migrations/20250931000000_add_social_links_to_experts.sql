-- Add additional social media links to experts table
ALTER TABLE experts ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS instagram_url TEXT;

-- Add comments
COMMENT ON COLUMN experts.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN experts.facebook_url IS 'Facebook profile URL';
COMMENT ON COLUMN experts.instagram_url IS 'Instagram profile URL';

