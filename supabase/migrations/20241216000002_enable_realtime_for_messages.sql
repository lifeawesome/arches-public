-- Enable real-time for messages system tables
-- This allows real-time subscriptions to work for chat functionality

-- Enable real-time for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable real-time for messages table  
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable real-time for project_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE project_requests;

-- Enable real-time for user online status in profiles table
-- (in case it's not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Add comments for documentation
COMMENT ON PUBLICATION supabase_realtime IS 'Real-time publication includes messages system tables for chat functionality';
