-- Add location fields to profiles table for better member search
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zipcode TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United States',
ADD COLUMN IF NOT EXISTS location_full TEXT; -- Combined location string for backward compatibility

-- Create indexes for location searches
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_state ON profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_location_full ON profiles(location_full);

-- Add other member-related fields that might be useful
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS experience_level TEXT,
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Create indexes for member searches
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company);
CREATE INDEX IF NOT EXISTS idx_profiles_industry ON profiles(industry);
CREATE INDEX IF NOT EXISTS idx_profiles_experience_level ON profiles(experience_level);
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON profiles USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_profiles_skills ON profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON profiles(is_verified);

-- Add comments for documentation
COMMENT ON COLUMN profiles.city IS 'City where the member is located';
COMMENT ON COLUMN profiles.state IS 'State/Province where the member is located';
COMMENT ON COLUMN profiles.zipcode IS 'Postal/ZIP code of the member';
COMMENT ON COLUMN profiles.country IS 'Country where the member is located';
COMMENT ON COLUMN profiles.location_full IS 'Full location string for backward compatibility';
COMMENT ON COLUMN profiles.company IS 'Company where the member works';
COMMENT ON COLUMN profiles.job_title IS 'Job title of the member';
COMMENT ON COLUMN profiles.industry IS 'Industry the member works in';
COMMENT ON COLUMN profiles.experience_level IS 'Professional experience level';
COMMENT ON COLUMN profiles.interests IS 'Array of member interests';
COMMENT ON COLUMN profiles.skills IS 'Array of member skills';
COMMENT ON COLUMN profiles.website IS 'Personal website URL';
COMMENT ON COLUMN profiles.github_url IS 'GitHub profile URL';
COMMENT ON COLUMN profiles.twitter_url IS 'Twitter profile URL';
COMMENT ON COLUMN profiles.is_verified IS 'Whether the member profile is verified';
