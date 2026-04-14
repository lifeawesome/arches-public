-- Create saved_experts table for users to bookmark/save experts
CREATE TABLE IF NOT EXISTS saved_experts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES experts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save an expert once
  UNIQUE(user_id, expert_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_experts_user_id ON saved_experts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_experts_expert_id ON saved_experts(expert_id);
CREATE INDEX IF NOT EXISTS idx_saved_experts_created_at ON saved_experts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_experts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own saved experts
CREATE POLICY "Users can view their own saved experts" ON saved_experts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can save experts
CREATE POLICY "Users can save experts" ON saved_experts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can unsave their own saved experts
CREATE POLICY "Users can unsave their own saved experts" ON saved_experts
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE saved_experts IS 'Stores user bookmarks/saved experts for easy access';
COMMENT ON COLUMN saved_experts.user_id IS 'The user who saved the expert';
COMMENT ON COLUMN saved_experts.expert_id IS 'The expert that was saved';

