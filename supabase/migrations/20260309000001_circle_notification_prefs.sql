-- Circle Notification Preferences
-- Per-circle notification settings layered on top of global user_notification_preferences

CREATE TABLE IF NOT EXISTS circle_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  -- Category-level toggles for Circle activity
  notify_posts BOOLEAN DEFAULT TRUE,
  notify_comments BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_membership BOOLEAN DEFAULT FALSE,
  notify_reactions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT circle_notification_prefs_unique UNIQUE (user_id, circle_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_circle_notification_prefs_user_id
  ON circle_notification_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_circle_notification_prefs_circle_id
  ON circle_notification_preferences (circle_id);

-- RLS
ALTER TABLE circle_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can see and manage only their own circle notification preferences
CREATE POLICY "Users can view their own circle notification prefs"
  ON circle_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own circle notification prefs"
  ON circle_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own circle notification prefs"
  ON circle_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own circle notification prefs"
  ON circle_notification_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION update_circle_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_circle_notification_prefs_updated_at
  BEFORE UPDATE ON circle_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_circle_notification_prefs_updated_at();

COMMENT ON TABLE circle_notification_preferences IS 'Per-circle notification preferences layered on top of global user_notification_preferences.';
