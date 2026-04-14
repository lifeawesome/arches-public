-- Create experts table for detailed expert profiles
CREATE TABLE IF NOT EXISTS experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic expert info
  is_active BOOLEAN DEFAULT TRUE,
  expertise_area TEXT NOT NULL,
  bio TEXT,
  years_experience INTEGER,
  hourly_rate INTEGER, -- in USD cents
  availability_status TEXT DEFAULT 'available', -- available, busy, unavailable
  availability_description TEXT,
  
  -- Professional links
  linkedin_url TEXT,
  portfolio_url TEXT,
  website_url TEXT,
  github_url TEXT,
  
  -- Resume and AI parsing
  resume_file_path TEXT, -- path to uploaded resume in storage
  resume_parsed_content JSONB, -- AI-parsed structured data
  resume_skills TEXT[], -- extracted skills array
  resume_experience JSONB, -- structured work experience
  resume_education JSONB, -- structured education
  resume_certifications JSONB, -- structured certifications
  searchable_content TEXT, -- full-text searchable content
  
  -- AI analysis results
  ai_analysis JSONB, -- comprehensive AI analysis
  skill_categories TEXT[], -- categorized skills
  industry_experience TEXT[], -- industries worked in
  project_types TEXT[], -- types of projects worked on
  
  -- Verification and quality
  is_verified BOOLEAN DEFAULT FALSE,
  verification_notes TEXT,
  profile_completeness_score INTEGER DEFAULT 0, -- 0-100
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_experts_user_id ON experts(user_id);
CREATE INDEX IF NOT EXISTS idx_experts_is_active ON experts(is_active);
CREATE INDEX IF NOT EXISTS idx_experts_expertise_area ON experts(expertise_area);
CREATE INDEX IF NOT EXISTS idx_experts_skills ON experts USING GIN(resume_skills);
CREATE INDEX IF NOT EXISTS idx_experts_searchable_content ON experts USING GIN(to_tsvector('english', searchable_content));
CREATE INDEX IF NOT EXISTS idx_experts_skill_categories ON experts USING GIN(skill_categories);
CREATE INDEX IF NOT EXISTS idx_experts_industry_experience ON experts USING GIN(industry_experience);
CREATE INDEX IF NOT EXISTS idx_experts_availability ON experts(availability_status);

-- Create full-text search index
-- Note: Using a simpler approach to avoid IMMUTABLE function issues
CREATE INDEX IF NOT EXISTS idx_experts_fulltext_search ON experts 
USING GIN(to_tsvector('english', 
  COALESCE(expertise_area, '') || ' ' ||
  COALESCE(bio, '') || ' ' ||
  COALESCE(searchable_content, '')
));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_experts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_experts_updated_at
  BEFORE UPDATE ON experts
  FOR EACH ROW
  EXECUTE FUNCTION update_experts_updated_at();

-- Add RLS policies
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;

-- Users can view all active experts
CREATE POLICY "Anyone can view active experts" ON experts
  FOR SELECT USING (is_active = true);

-- Users can only manage their own expert profile
CREATE POLICY "Users can manage own expert profile" ON experts
  FOR ALL USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE experts IS 'Detailed expert profiles with AI-parsed resume data';
COMMENT ON COLUMN experts.resume_parsed_content IS 'AI-parsed structured resume data';
COMMENT ON COLUMN experts.searchable_content IS 'Full-text searchable content from resume and profile';
COMMENT ON COLUMN experts.ai_analysis IS 'Comprehensive AI analysis of expertise and experience';
COMMENT ON COLUMN experts.profile_completeness_score IS 'Calculated completeness score 0-100';
