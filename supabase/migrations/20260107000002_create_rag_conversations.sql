-- RAG Chatbot: Create conversation tables
-- This migration creates tables for storing RAG chatbot conversations and messages

-- ============================================================================
-- RAG Conversations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_rag_conversations_user_id 
ON rag_conversations (user_id);

-- Create index for ordering by date
CREATE INDEX IF NOT EXISTS idx_rag_conversations_created_at 
ON rag_conversations (created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE rag_conversations IS 'Stores RAG chatbot conversation sessions';
COMMENT ON COLUMN rag_conversations.title IS 'Auto-generated title from first message or user-provided';

-- ============================================================================
-- RAG Conversation Messages Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  tool_calls JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for conversation lookup
CREATE INDEX IF NOT EXISTS idx_rag_messages_conversation_id 
ON rag_conversation_messages (conversation_id);

-- Create index for ordering messages
CREATE INDEX IF NOT EXISTS idx_rag_messages_created_at 
ON rag_conversation_messages (conversation_id, created_at);

-- Add comments for documentation
COMMENT ON TABLE rag_conversation_messages IS 'Stores individual messages in RAG chatbot conversations';
COMMENT ON COLUMN rag_conversation_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN rag_conversation_messages.sources IS 'Array of cited content sources with type, id, title, url';
COMMENT ON COLUMN rag_conversation_messages.tool_calls IS 'Array of tool calls made during response generation';

-- ============================================================================
-- Updated At Trigger for Conversations
-- ============================================================================

CREATE OR REPLACE FUNCTION update_rag_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rag_conversations_updated_at
BEFORE UPDATE ON rag_conversations
FOR EACH ROW
EXECUTE FUNCTION update_rag_conversations_updated_at();

-- ============================================================================
-- Update Conversation on New Message
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE rag_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rag_message_updates_conversation
AFTER INSERT ON rag_conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- Auto-generate Conversation Title
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_generate_conversation_title()
RETURNS TRIGGER AS $$
DECLARE
  v_first_message TEXT;
  v_title TEXT;
BEGIN
  -- Only for user messages on conversations without a title
  IF NEW.role = 'user' THEN
    SELECT title INTO v_title FROM rag_conversations WHERE id = NEW.conversation_id;
    
    IF v_title IS NULL THEN
      -- Generate title from first 50 chars of message
      v_first_message := LEFT(NEW.content, 50);
      IF LENGTH(NEW.content) > 50 THEN
        v_first_message := v_first_message || '...';
      END IF;
      
      UPDATE rag_conversations
      SET title = v_first_message
      WHERE id = NEW.conversation_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_title_on_first_message
AFTER INSERT ON rag_conversation_messages
FOR EACH ROW
EXECUTE FUNCTION auto_generate_conversation_title();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE rag_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own conversations
CREATE POLICY "Users can view own conversations"
ON rag_conversations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
ON rag_conversations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
ON rag_conversations FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
ON rag_conversations FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Users can only access messages in their own conversations
CREATE POLICY "Users can view messages in own conversations"
ON rag_conversation_messages FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM rag_conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in own conversations"
ON rag_conversation_messages FOR INSERT
TO authenticated
WITH CHECK (
  conversation_id IN (
    SELECT id FROM rag_conversations WHERE user_id = auth.uid()
  )
);

-- Service role has full access
CREATE POLICY "Service role can manage conversations"
ON rag_conversations FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage messages"
ON rag_conversation_messages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get conversation with messages
CREATE OR REPLACE FUNCTION get_rag_conversation_with_messages(p_conversation_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  conversation_title TEXT,
  conversation_created_at TIMESTAMP WITH TIME ZONE,
  conversation_updated_at TIMESTAMP WITH TIME ZONE,
  message_id UUID,
  message_role TEXT,
  message_content TEXT,
  message_sources JSONB,
  message_tool_calls JSONB,
  message_created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as conversation_id,
    c.title as conversation_title,
    c.created_at as conversation_created_at,
    c.updated_at as conversation_updated_at,
    m.id as message_id,
    m.role as message_role,
    m.content as message_content,
    m.sources as message_sources,
    m.tool_calls as message_tool_calls,
    m.created_at as message_created_at
  FROM rag_conversations c
  LEFT JOIN rag_conversation_messages m ON c.id = m.conversation_id
  WHERE c.id = p_conversation_id
  ORDER BY m.created_at;
END;
$$;

COMMENT ON FUNCTION get_rag_conversation_with_messages IS 'Get a conversation with all its messages ordered by creation time.';

-- Get user conversations list
CREATE OR REPLACE FUNCTION get_user_rag_conversations(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  message_count BIGINT,
  last_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.created_at,
    c.updated_at,
    COUNT(m.id) as message_count,
    (
      SELECT content 
      FROM rag_conversation_messages 
      WHERE conversation_id = c.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) as last_message
  FROM rag_conversations c
  LEFT JOIN rag_conversation_messages m ON c.id = m.conversation_id
  WHERE c.user_id = p_user_id
  GROUP BY c.id, c.title, c.created_at, c.updated_at
  ORDER BY c.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_user_rag_conversations IS 'Get paginated list of user conversations with message counts.';

