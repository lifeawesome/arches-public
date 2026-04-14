-- Create surveys system for user research
-- This enables admins to create, distribute, and analyze surveys

-- Create survey_status enum
CREATE TYPE survey_status AS ENUM ('draft', 'active', 'closed');

-- Create question_type enum
CREATE TYPE question_type AS ENUM (
  'multiple_choice',
  'checkboxes',
  'text',
  'long_text',
  'rating',
  'scale',
  'matrix'
);

-- Create surveys table
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status survey_status DEFAULT 'draft' NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_audience JSONB DEFAULT '{"type": "all"}'::jsonb,
  delivery_method TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  published_at TIMESTAMP WITH TIME ZONE,
  closes_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create survey_questions table
CREATE TABLE survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  type question_type NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT false,
  conditional_logic JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(survey_id, order_index)
);

-- Create survey_responses table
CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one response per user per survey (if not anonymous)
  UNIQUE(survey_id, user_id)
);

-- Create survey_notifications table
CREATE TABLE survey_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivery_method TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_created_by ON surveys(created_by);
CREATE INDEX idx_surveys_published_at ON surveys(published_at);

CREATE INDEX idx_survey_questions_survey_id ON survey_questions(survey_id);
CREATE INDEX idx_survey_questions_order ON survey_questions(survey_id, order_index);

CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX idx_survey_responses_completed ON survey_responses(survey_id, completed_at);

CREATE INDEX idx_survey_notifications_survey_id ON survey_notifications(survey_id);
CREATE INDEX idx_survey_notifications_user_id ON survey_notifications(user_id);
CREATE INDEX idx_survey_notifications_viewed ON survey_notifications(viewed_at);

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_survey_questions_updated_at
  BEFORE UPDATE ON survey_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_survey_responses_updated_at
  BEFORE UPDATE ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function: Get survey statistics
CREATE OR REPLACE FUNCTION get_survey_stats(p_survey_id UUID)
RETURNS TABLE (
  total_sent INTEGER,
  total_views INTEGER,
  total_responses INTEGER,
  total_completed INTEGER,
  response_rate NUMERIC,
  completion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM survey_notifications WHERE survey_id = p_survey_id),
    (SELECT COUNT(*)::INTEGER FROM survey_notifications WHERE survey_id = p_survey_id AND viewed_at IS NOT NULL),
    (SELECT COUNT(*)::INTEGER FROM survey_responses WHERE survey_id = p_survey_id),
    (SELECT COUNT(*)::INTEGER FROM survey_responses WHERE survey_id = p_survey_id AND completed_at IS NOT NULL),
    CASE
      WHEN (SELECT COUNT(*) FROM survey_notifications WHERE survey_id = p_survey_id) > 0
      THEN ROUND(
        (SELECT COUNT(*)::NUMERIC FROM survey_responses WHERE survey_id = p_survey_id) /
        (SELECT COUNT(*)::NUMERIC FROM survey_notifications WHERE survey_id = p_survey_id) * 100,
        2
      )
      ELSE 0
    END,
    CASE
      WHEN (SELECT COUNT(*) FROM survey_responses WHERE survey_id = p_survey_id) > 0
      THEN ROUND(
        (SELECT COUNT(*)::NUMERIC FROM survey_responses WHERE survey_id = p_survey_id AND completed_at IS NOT NULL) /
        (SELECT COUNT(*)::NUMERIC FROM survey_responses WHERE survey_id = p_survey_id) * 100,
        2
      )
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user can access survey
CREATE OR REPLACE FUNCTION check_user_can_access_survey(p_survey_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_survey RECORD;
  v_profile RECORD;
  v_target_audience JSONB;
BEGIN
  -- Get survey details
  SELECT * INTO v_survey FROM surveys WHERE id = p_survey_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  v_target_audience := v_survey.target_audience;
  
  -- If targeting all users
  IF v_target_audience->>'type' = 'all' THEN
    RETURN TRUE;
  END IF;
  
  -- Get user profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check role-based targeting
  IF v_target_audience->>'type' = 'role' THEN
    IF v_target_audience->'roles' ? v_profile.role THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Check subscription tier targeting
  IF v_target_audience->>'type' = 'subscription_tier' THEN
    IF v_target_audience->'tiers' ? v_profile.plan_id THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Check custom user list
  IF v_target_audience->>'type' = 'custom' THEN
    IF v_target_audience->'user_ids' ? p_user_id::TEXT THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for surveys table
-- Admins can do everything
CREATE POLICY "Admins can manage all surveys"
  ON surveys
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Users can view active surveys they have access to
CREATE POLICY "Users can view active surveys"
  ON surveys
  FOR SELECT
  TO authenticated
  USING (
    status = 'active' AND
    check_user_can_access_survey(id, auth.uid())
  );

-- RLS Policies for survey_questions table
-- Admins can manage all questions
CREATE POLICY "Admins can manage all survey questions"
  ON survey_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = survey_questions.survey_id
      AND is_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = survey_questions.survey_id
      AND is_admin(auth.uid())
    )
  );

-- Users can view questions for active surveys they can access
CREATE POLICY "Users can view questions for accessible surveys"
  ON survey_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = survey_questions.survey_id
      AND surveys.status = 'active'
      AND check_user_can_access_survey(surveys.id, auth.uid())
    )
  );

-- RLS Policies for survey_responses table
-- Admins can view all responses
CREATE POLICY "Admins can view all survey responses"
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Users can insert their own responses
CREATE POLICY "Users can create their own responses"
  ON survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = survey_responses.survey_id
      AND surveys.status = 'active'
      AND check_user_can_access_survey(surveys.id, auth.uid())
    )
  );

-- Users can update their own incomplete responses
CREATE POLICY "Users can update their own incomplete responses"
  ON survey_responses
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    completed_at IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- Users can view their own responses
CREATE POLICY "Users can view their own responses"
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for survey_notifications table
-- Admins can manage all notifications
CREATE POLICY "Admins can manage all survey notifications"
  ON survey_notifications
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Users can view and update their own notifications
CREATE POLICY "Users can view their own notifications"
  ON survey_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON survey_notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE surveys IS 'Admin-created surveys for user research';
COMMENT ON TABLE survey_questions IS 'Questions belonging to surveys with various types';
COMMENT ON TABLE survey_responses IS 'User responses to surveys';
COMMENT ON TABLE survey_notifications IS 'Tracks survey delivery and engagement';
COMMENT ON FUNCTION get_survey_stats IS 'Returns engagement statistics for a survey';
COMMENT ON FUNCTION check_user_can_access_survey IS 'Validates if a user matches survey targeting criteria';

