-- Add in_app_notifications column to user_notification_preferences table
-- This allows users to control whether they receive in-app notifications

ALTER TABLE user_notification_preferences
ADD COLUMN IF NOT EXISTS in_app_notifications BOOLEAN DEFAULT TRUE;

-- Add comment explaining the column
COMMENT ON COLUMN user_notification_preferences.in_app_notifications IS 
'Whether the user wants to receive in-app notifications. Critical updates will always be shown regardless of this setting.';

