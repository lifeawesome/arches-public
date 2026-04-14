-- Fix conversation deletion and unread count issues

-- 1. Add DELETE policy for conversations
-- Users should be able to delete conversations they participate in
CREATE POLICY "Participants can delete conversations" ON conversations
  FOR DELETE USING (auth.uid() = ANY(participants));

-- 2. Add DELETE policy for messages (cascade behavior needs RLS too)
-- Users should be able to delete messages in their conversations
CREATE POLICY "Users can delete messages in their conversations" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = messages.conversation_id 
      AND auth.uid() = ANY(conversations.participants)
    )
  );

-- 3. Improve the mark_message_as_read function to update conversation unread count
-- This ensures the unread count is properly updated when messages are marked as read

-- Drop the existing function first (it may have a different return type)
DROP FUNCTION IF EXISTS mark_message_as_read(UUID, UUID);

-- Create the improved version
CREATE OR REPLACE FUNCTION mark_message_as_read(message_id UUID, user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Add user_id to read_by array if not already there
  UPDATE messages
  SET 
    read_by = ARRAY(SELECT DISTINCT unnest(read_by || ARRAY[user_id])),
    updated_at = NOW()
  WHERE id = message_id
    AND NOT (user_id = ANY(read_by)); -- Only update if not already read

  -- Update conversation's last_message_at to trigger refresh
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = (SELECT conversation_id FROM messages WHERE id = message_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a helper function to get unread message count for a conversation
CREATE OR REPLACE FUNCTION get_unread_message_count(conv_id UUID, user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM messages
    WHERE conversation_id = conv_id
      AND sender_id != user_id  -- Don't count messages sent by the user
      AND NOT (user_id = ANY(read_by))  -- Not marked as read by this user
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON POLICY "Participants can delete conversations" ON conversations IS 
  'Allows users to delete conversations they are participants in';

COMMENT ON POLICY "Users can delete messages in their conversations" ON messages IS 
  'Allows users to delete messages in conversations they participate in';

COMMENT ON FUNCTION mark_message_as_read(UUID, UUID) IS 
  'Marks a message as read by a specific user and updates conversation timestamp';

COMMENT ON FUNCTION get_unread_message_count(UUID, UUID) IS 
  'Returns the count of unread messages in a conversation for a specific user';

