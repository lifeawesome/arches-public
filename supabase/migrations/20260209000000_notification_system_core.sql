-- Notification System Core
-- Creates notification tables, enum, and user preferences for timezone-based scheduling

-- Create notification event type enum
CREATE TYPE notification_event_type AS ENUM (
  -- Task-related
  'task_completed',
  'task_reminder_daily',
  'task_reminder_afternoon',
  'task_reminder_evening',
  
  -- Streak-related
  'streak_milestone',
  'streak_broken',
  'streak_warning', -- Streak about to break (last chance)
  'streak_freeze_available', -- Streak freeze can be used
  
  -- Achievement-related
  'achievement_unlocked',
  'level_up',
  'xp_milestone',
  
  -- Motivational
  'comeback_reminder', -- User hasn't been active in X days
  'weekly_summary',
  'motivational_message'
);

-- Create notification events table
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type notification_event_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_status TEXT CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification queue table (for scheduled notifications)
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type notification_event_type NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification_events
CREATE INDEX idx_notification_events_user_id ON notification_events(user_id);
CREATE INDEX idx_notification_events_event_type ON notification_events(event_type);
CREATE INDEX idx_notification_events_read_at ON notification_events(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notification_events_created_at ON notification_events(user_id, created_at DESC);
CREATE INDEX idx_notification_events_scheduled_for ON notification_events(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_notification_events_email_status ON notification_events(email_status) WHERE email_status IS NOT NULL;

-- Create indexes for notification_queue
CREATE INDEX idx_notification_queue_status ON notification_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_user_id ON notification_queue(user_id);

-- Enable Row Level Security
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own notifications
CREATE POLICY "Users can view their own notification events" ON notification_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification events" ON notification_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notification queue items" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Add timezone and notification preferences to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "reminder_times": [9, 14, 20],
  "quiet_hours_start": 22,
  "quiet_hours_end": 7
}'::jsonb;

-- Create index for timezone queries
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone);

-- Add comments for documentation
COMMENT ON TABLE notification_events IS 'In-app notification events for users. Supports future email notifications via channels array.';
COMMENT ON COLUMN notification_events.channels IS 'Array of delivery channels: in_app, email, etc. Defaults to in_app for MVP.';
COMMENT ON COLUMN notification_events.email_sent_at IS 'Timestamp when email notification was sent (future feature)';
COMMENT ON COLUMN notification_events.email_status IS 'Email delivery status: pending, sent, delivered, failed (future feature)';
COMMENT ON TABLE notification_queue IS 'Queue for scheduled notifications that need to be processed at specific times based on user timezone.';
COMMENT ON COLUMN profiles.timezone IS 'User timezone (e.g., America/New_York, Europe/London). Defaults to UTC.';
COMMENT ON COLUMN profiles.notification_preferences IS 'JSONB object with notification preferences: reminder_times (array of hours), quiet_hours_start, quiet_hours_end';
