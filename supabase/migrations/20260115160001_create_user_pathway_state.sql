-- Create enums for user state
CREATE TYPE pathway_status AS ENUM ('active', 'paused', 'completed');
CREATE TYPE level_status AS ENUM ('locked', 'active', 'completed');
CREATE TYPE task_instance_status AS ENUM ('assigned', 'started', 'completed', 'skipped');
CREATE TYPE xp_source_type AS ENUM ('task', 'bonus', 'achievement');

-- User pathways table (enrollment)
CREATE TABLE IF NOT EXISTS user_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pathway_id UUID NOT NULL REFERENCES pathways(id) ON DELETE CASCADE,
  pathway_version INTEGER NOT NULL,
  status pathway_status DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pathway_id)
);

-- User level progress table
CREATE TABLE IF NOT EXISTS user_level_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  status level_status DEFAULT 'locked',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, level_id)
);

-- User task instances table (today's task assignments)
CREATE TABLE IF NOT EXISTS user_task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pathway_id UUID NOT NULL REFERENCES pathways(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_for_date DATE NOT NULL,
  status task_instance_status DEFAULT 'assigned',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  xp_awarded INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User task submissions table (proof of completion)
CREATE TABLE IF NOT EXISTS user_task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_task_instance_id UUID NOT NULL REFERENCES user_task_instances(id) ON DELETE CASCADE,
  submission_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shareable BOOLEAN DEFAULT false,
  shared_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_task_instance_id)
);

-- User XP ledger table
CREATE TABLE IF NOT EXISTS user_xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type xp_source_type NOT NULL,
  source_id UUID,
  xp_delta INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User streaks table
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_user_pathways_user_id ON user_pathways(user_id);
CREATE INDEX idx_user_pathways_pathway_id ON user_pathways(pathway_id);
CREATE INDEX idx_user_pathways_status ON user_pathways(user_id, status);
CREATE INDEX idx_user_level_progress_user_id ON user_level_progress(user_id);
CREATE INDEX idx_user_level_progress_level_id ON user_level_progress(level_id);
CREATE INDEX idx_user_level_progress_status ON user_level_progress(user_id, status);
CREATE INDEX idx_user_task_instances_user_id ON user_task_instances(user_id);
CREATE INDEX idx_user_task_instances_pathway_id ON user_task_instances(pathway_id);
CREATE INDEX idx_user_task_instances_task_id ON user_task_instances(task_id);
CREATE INDEX idx_user_task_instances_date ON user_task_instances(user_id, assigned_for_date);
CREATE INDEX idx_user_task_instances_status ON user_task_instances(user_id, status);
CREATE INDEX idx_user_task_submissions_instance_id ON user_task_submissions(user_task_instance_id);
CREATE INDEX idx_user_task_submissions_shareable ON user_task_submissions(is_shareable, shared_at) WHERE is_shareable = true;
CREATE INDEX idx_user_xp_ledger_user_id ON user_xp_ledger(user_id);
CREATE INDEX idx_user_xp_ledger_created_at ON user_xp_ledger(user_id, created_at DESC);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- Enable Row Level Security
ALTER TABLE user_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_level_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view their own pathways" ON user_pathways
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pathways" ON user_pathways
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pathways" ON user_pathways
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own level progress" ON user_level_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own level progress" ON user_level_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own level progress" ON user_level_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own task instances" ON user_task_instances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task instances" ON user_task_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task instances" ON user_task_instances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own task submissions" ON user_task_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_task_instances 
      WHERE user_task_instances.id = user_task_submissions.user_task_instance_id 
      AND user_task_instances.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own task submissions" ON user_task_submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_task_instances 
      WHERE user_task_instances.id = user_task_submissions.user_task_instance_id 
      AND user_task_instances.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own task submissions" ON user_task_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_task_instances 
      WHERE user_task_instances.id = user_task_submissions.user_task_instance_id 
      AND user_task_instances.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own XP ledger" ON user_xp_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own streaks" ON user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_user_pathways_updated_at BEFORE UPDATE ON user_pathways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_level_progress_updated_at BEFORE UPDATE ON user_level_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_task_instances_updated_at BEFORE UPDATE ON user_task_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_task_submissions_updated_at BEFORE UPDATE ON user_task_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_streaks_updated_at BEFORE UPDATE ON user_streaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

