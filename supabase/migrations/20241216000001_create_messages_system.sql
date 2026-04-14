-- Create messages system for Arches Network
-- This includes direct messages, project requests, and system notifications

-- Create message types enum
CREATE TYPE message_type AS ENUM ('direct_message', 'project_request', 'system_notification');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'archived');
CREATE TYPE project_request_status AS ENUM ('pending', 'accepted', 'declined', 'completed');

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  type message_type DEFAULT 'direct_message',
  participants UUID[] NOT NULL, -- Array of user IDs
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type message_type DEFAULT 'direct_message',
  status message_status DEFAULT 'sent',
  read_by UUID[] DEFAULT '{}', -- Array of user IDs who have read the message
  metadata JSONB DEFAULT '{}', -- Additional data like attachments, project details, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT messages_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create project requests table (extends messages for expert project requests)
CREATE TABLE IF NOT EXISTS project_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  expert_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  project_description TEXT NOT NULL,
  budget_min INTEGER, -- in USD cents
  budget_max INTEGER, -- in USD cents
  timeline TEXT, -- e.g., "2-3 weeks", "1 month", "ongoing"
  required_skills TEXT[] DEFAULT '{}',
  project_type TEXT, -- e.g., "Web Development", "Consulting", "Design"
  status project_request_status DEFAULT 'pending',
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT project_requests_title_not_empty CHECK (length(trim(project_title)) > 0),
  CONSTRAINT project_requests_description_not_empty CHECK (length(trim(project_description)) > 0),
  CONSTRAINT project_requests_budget_valid CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
);

-- Create message notifications table (for email notifications)
CREATE TABLE IF NOT EXISTS message_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  notification_type TEXT DEFAULT 'email', -- 'email', 'push', 'sms'
  sent_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  email_message_id TEXT, -- External email service message ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_direct_messages BOOLEAN DEFAULT TRUE,
  email_project_requests BOOLEAN DEFAULT TRUE,
  email_system_notifications BOOLEAN DEFAULT TRUE,
  email_frequency TEXT DEFAULT 'immediate', -- 'immediate', 'hourly', 'daily', 'weekly'
  push_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN(read_by);

CREATE INDEX IF NOT EXISTS idx_project_requests_expert_id ON project_requests(expert_id);
CREATE INDEX IF NOT EXISTS idx_project_requests_client_id ON project_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_project_requests_status ON project_requests(status);
CREATE INDEX IF NOT EXISTS idx_project_requests_created_at ON project_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_notifications_user_id ON message_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_message_notifications_message_id ON message_notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_message_notifications_delivery_status ON message_notifications(delivery_status);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Participants can update conversations" ON conversations
  FOR UPDATE USING (auth.uid() = ANY(participants));

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND auth.uid() = ANY(conversations.participants)
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND auth.uid() = ANY(conversations.participants)
    )
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- RLS Policies for project requests
CREATE POLICY "Experts and clients can view their project requests" ON project_requests
  FOR SELECT USING (auth.uid() = expert_id OR auth.uid() = client_id);

CREATE POLICY "Clients can create project requests" ON project_requests
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Experts and clients can update project requests" ON project_requests
  FOR UPDATE USING (auth.uid() = expert_id OR auth.uid() = client_id);

-- RLS Policies for message notifications
CREATE POLICY "Users can view their own notifications" ON message_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON message_notifications
  FOR INSERT WITH CHECK (true); -- Allow system to create notifications

-- RLS Policies for notification preferences
CREATE POLICY "Users can view their own notification preferences" ON user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON user_notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Create functions for message handling
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update conversation timestamp when new message is added
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION mark_message_as_read(message_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE messages 
  SET read_by = array_append(read_by, user_id),
      updated_at = NOW()
  WHERE id = message_id 
    AND NOT (user_id = ANY(read_by))
    AND EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND user_id = ANY(conversations.participants)
    );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE user_id = ANY(c.participants)
      AND NOT (user_id = ANY(m.read_by))
      AND m.sender_id != user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE conversations IS 'Chat conversations between users';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE project_requests IS 'Project requests from clients to experts';
COMMENT ON TABLE message_notifications IS 'Email and push notification tracking';
COMMENT ON TABLE user_notification_preferences IS 'User preferences for notifications';

COMMENT ON COLUMN conversations.participants IS 'Array of user IDs participating in the conversation';
COMMENT ON COLUMN messages.read_by IS 'Array of user IDs who have read this message';
COMMENT ON COLUMN messages.metadata IS 'Additional message data (attachments, project details, etc.)';
COMMENT ON COLUMN project_requests.budget_min IS 'Minimum budget in USD cents';
COMMENT ON COLUMN project_requests.budget_max IS 'Maximum budget in USD cents';

