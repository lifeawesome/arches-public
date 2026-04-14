-- Add communication preferences to profiles table
-- This migration adds columns for managing user communication and privacy preferences

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS communication_preferences JSONB DEFAULT '{
  "notifications": {
    "email": {
      "new_message": true,
      "message_read": false,
      "new_conversation": true,
      "project_request": true,
      "digest_frequency": "instant"
    },
    "push": {
      "enabled": false,
      "sound": true,
      "desktop": true
    }
  },
  "privacy": {
    "who_can_message": "all_members",
    "show_online_status": true,
    "show_last_seen": true,
    "send_read_receipts": true,
    "receive_read_receipts": true
  },
  "message_management": {
    "auto_archive_days": null,
    "message_retention_days": null
  }
}'::jsonb;

-- Add index for faster queries on communication preferences
CREATE INDEX IF NOT EXISTS idx_profiles_communication_preferences 
ON profiles USING gin (communication_preferences);

-- Add comment explaining the schema
COMMENT ON COLUMN profiles.communication_preferences IS 
'User communication and privacy preferences stored as JSONB. Includes email/push notifications, privacy settings (who can message, online status, read receipts), and message management (auto-archive, retention).';

