-- Create conversation storage for Langflow chat sessions
CREATE TABLE IF NOT EXISTS work_request_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- Auto-generated conversation title
  status TEXT DEFAULT 'active', -- active, completed, archived
  
  -- Conversation metadata
  total_messages INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Work request context
  work_request_id UUID REFERENCES work_requests(id) ON DELETE SET NULL,
  conversation_type TEXT DEFAULT 'work_request_creation', -- work_request_creation, work_request_edit, general
  
  -- Langflow state
  langflow_state JSONB, -- Store Langflow's internal state
  current_step TEXT, -- gathering, proposing, finalizing, completed
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS work_request_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES work_request_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, tool_call, tool_result, error
  
  -- Tool integration
  tool_name TEXT, -- Name of tool called (if applicable)
  tool_input JSONB, -- Input parameters for tool
  tool_output JSONB, -- Output from tool execution
  
  -- Metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences and context
CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- AI behavior preferences
  preferred_communication_style TEXT DEFAULT 'professional', -- professional, casual, detailed, concise
  preferred_expertise_areas TEXT[], -- User's preferred areas of expertise
  budget_range_min INTEGER, -- Minimum budget in cents
  budget_range_max INTEGER, -- Maximum budget in cents
  preferred_timeline TEXT, -- urgent, normal, flexible
  
  -- Context from past interactions
  common_project_types TEXT[], -- Types of projects user typically requests
  preferred_experts TEXT[], -- Expert IDs user has worked with before
  learning_preferences JSONB, -- How user likes to learn/understand
  
  -- Langflow specific
  langflow_session_preferences JSONB, -- Custom Langflow flow preferences
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON work_request_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON work_request_conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_work_request_id ON work_request_conversations(work_request_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON work_request_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON work_request_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON work_request_conversation_messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON work_request_conversation_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_ai_preferences(user_id);

-- Update triggers
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversations_updated_at
  BEFORE UPDATE ON work_request_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversations_updated_at();

CREATE TRIGGER trigger_update_user_preferences_updated_at
  BEFORE UPDATE ON user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_conversations_updated_at();

-- Function to update conversation message count and last message time
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_request_conversations 
  SET 
    total_messages = total_messages + 1,
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_stats
  AFTER INSERT ON work_request_conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_stats();

-- Row Level Security
ALTER TABLE work_request_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_request_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for conversations (optimized with subqueries to prevent re-evaluation per row)
CREATE POLICY "Users can view own conversations" ON work_request_conversations
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create conversations" ON work_request_conversations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own conversations" ON work_request_conversations
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own conversations" ON work_request_conversations
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Policies for messages (optimized with subqueries to prevent re-evaluation per row)
CREATE POLICY "Users can view messages from own conversations" ON work_request_conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM work_request_conversations 
      WHERE work_request_conversations.id = work_request_conversation_messages.conversation_id 
      AND work_request_conversations.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create messages in own conversations" ON work_request_conversation_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_request_conversations 
      WHERE work_request_conversations.id = work_request_conversation_messages.conversation_id 
      AND work_request_conversations.user_id = (select auth.uid())
    )
  );

-- Policies for user preferences (optimized with subqueries to prevent re-evaluation per row)
CREATE POLICY "Users can view own preferences" ON user_ai_preferences
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own preferences" ON user_ai_preferences
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own preferences" ON user_ai_preferences
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- Comments
COMMENT ON TABLE work_request_conversations IS 'Stores Langflow chat sessions for work request creation - uses conversation ID as session ID';
COMMENT ON TABLE work_request_conversation_messages IS 'Individual messages within work request conversations';
COMMENT ON TABLE user_ai_preferences IS 'User preferences and context for AI interactions';

COMMENT ON COLUMN work_request_conversations.langflow_state IS 'Serialized Langflow flow state';
COMMENT ON COLUMN work_request_conversations.current_step IS 'Current step in the conversation flow';
COMMENT ON COLUMN work_request_conversation_messages.tool_name IS 'Name of Langflow tool called';
COMMENT ON COLUMN work_request_conversation_messages.tool_input IS 'Input parameters for tool execution';
COMMENT ON COLUMN work_request_conversation_messages.tool_output IS 'Output from tool execution';
