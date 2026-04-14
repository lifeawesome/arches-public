-- Create enums for pathway system
CREATE TYPE task_type AS ENUM ('create', 'refine', 'publish', 'practice', 'review', 'connect');
CREATE TYPE proof_type AS ENUM ('url', 'upload', 'text', 'attestation');
CREATE TYPE unlock_rule_type AS ENUM ('COMPLETE_LEVEL', 'COMPLETE_TASK', 'XP_THRESHOLD', 'STREAK_MIN', 'MANUAL_APPROVAL');
CREATE TYPE task_input_type AS ENUM ('short_text', 'long_text', 'url', 'upload', 'multi_select', 'checkbox');

-- Pathways table
CREATE TABLE IF NOT EXISTS pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  outcomes JSONB DEFAULT '[]'::jsonb,
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5) DEFAULT 3,
  estimated_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Levels table
CREATE TABLE IF NOT EXISTS levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id UUID NOT NULL REFERENCES pathways(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  unlock_rule_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pathway_id, order_index)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  task_type task_type NOT NULL,
  time_min INTEGER DEFAULT 15,
  time_max INTEGER DEFAULT 30,
  objective TEXT NOT NULL,
  why_it_matters TEXT,
  instructions TEXT,
  xp_value INTEGER DEFAULT 25,
  is_keystone BOOLEAN DEFAULT false,
  template_refs JSONB DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(level_id, order_index)
);

-- Task steps table
CREATE TABLE IF NOT EXISTS task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  input_type task_input_type NOT NULL,
  is_required BOOLEAN DEFAULT true,
  validation JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, order_index)
);

-- Task proof requirements table
CREATE TABLE IF NOT EXISTS task_proof_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  proof_type proof_type NOT NULL,
  required BOOLEAN DEFAULT false,
  instructions TEXT,
  examples JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unlock rules table
CREATE TABLE IF NOT EXISTS unlock_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type unlock_rule_type NOT NULL,
  rule_params JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  criteria_type TEXT NOT NULL,
  criteria_params JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_levels_pathway_id ON levels(pathway_id);
CREATE INDEX idx_levels_order_index ON levels(pathway_id, order_index);
CREATE INDEX idx_tasks_level_id ON tasks(level_id);
CREATE INDEX idx_tasks_order_index ON tasks(level_id, order_index);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
CREATE INDEX idx_task_steps_task_id ON task_steps(task_id);
CREATE INDEX idx_task_steps_order_index ON task_steps(task_id, order_index);
CREATE INDEX idx_task_proof_requirements_task_id ON task_proof_requirements(task_id);
CREATE INDEX idx_pathways_slug ON pathways(slug);
CREATE INDEX idx_pathways_is_active ON pathways(is_active);

-- Add foreign key constraint for unlock_rule_id in levels (self-reference)
ALTER TABLE levels ADD CONSTRAINT fk_levels_unlock_rule 
  FOREIGN KEY (unlock_rule_id) REFERENCES unlock_rules(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_proof_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Content tables are public read, admin write
-- Pathways: Public can read active pathways
CREATE POLICY "Public can view active pathways" ON pathways
  FOR SELECT USING (is_active = true);

-- Levels: Public can read levels of active pathways
CREATE POLICY "Public can view levels of active pathways" ON levels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pathways WHERE pathways.id = levels.pathway_id AND pathways.is_active = true
    )
  );

-- Tasks: Public can read tasks of active pathways
CREATE POLICY "Public can view tasks of active pathways" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM levels 
      JOIN pathways ON pathways.id = levels.pathway_id 
      WHERE levels.id = tasks.level_id AND pathways.is_active = true
    )
  );

-- Task steps: Public can read steps of visible tasks
CREATE POLICY "Public can view task steps" ON task_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN levels ON levels.id = tasks.level_id
      JOIN pathways ON pathways.id = levels.pathway_id
      WHERE tasks.id = task_steps.task_id AND pathways.is_active = true
    )
  );

-- Task proof requirements: Public can read requirements of visible tasks
CREATE POLICY "Public can view task proof requirements" ON task_proof_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN levels ON levels.id = tasks.level_id
      JOIN pathways ON pathways.id = levels.pathway_id
      WHERE tasks.id = task_proof_requirements.task_id AND pathways.is_active = true
    )
  );

-- Unlock rules: Public can read unlock rules
CREATE POLICY "Public can view unlock rules" ON unlock_rules
  FOR SELECT USING (true);

-- Achievements: Public can read achievements
CREATE POLICY "Public can view achievements" ON achievements
  FOR SELECT USING (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pathways_updated_at BEFORE UPDATE ON pathways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_levels_updated_at BEFORE UPDATE ON levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_achievements_updated_at BEFORE UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

