-- Migration: Automatic Content Indexing to content_embeddings
-- This migration adds database triggers to automatically index experts
-- to the content_embeddings table when they are created or updated.

-- ============================================================================
-- Create indexing queue table for async processing
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_indexing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_indexing_queue_status_pending 
ON content_indexing_queue(status, created_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_indexing_queue_content 
ON content_indexing_queue(content_type, content_id);

COMMENT ON TABLE content_indexing_queue IS 'Queue for async content indexing to content_embeddings table';

-- ============================================================================
-- Function to add to indexing queue
-- ============================================================================

CREATE OR REPLACE FUNCTION enqueue_content_indexing(
  p_content_type TEXT,
  p_content_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Check if there's already a pending or processing item
  SELECT id INTO v_queue_id
  FROM public.content_indexing_queue
  WHERE content_type = p_content_type 
    AND content_id = p_content_id
    AND status IN ('pending', 'processing')
  LIMIT 1;
  
  -- If found, update it
  IF v_queue_id IS NOT NULL THEN
    UPDATE public.content_indexing_queue
    SET updated_at = NOW(),
        retry_count = retry_count + 1
    WHERE id = v_queue_id;
    
    RETURN v_queue_id;
  END IF;
  
  -- Otherwise, insert new entry
  INSERT INTO public.content_indexing_queue (content_type, content_id, status)
  VALUES (p_content_type, p_content_id, 'pending')
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;

COMMENT ON FUNCTION enqueue_content_indexing IS 'Adds content to the indexing queue for async processing';

-- ============================================================================
-- Trigger function for experts table
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_expert_content_indexing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only index if expert is active
  IF NEW.is_active = true THEN
    -- Add to indexing queue
    PERFORM public.enqueue_content_indexing('expert', NEW.id::text);
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    -- If expert was deactivated, we could optionally delete from content_embeddings
    -- For now, we'll leave it (user can manually clean up)
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_expert_content_indexing IS 'Trigger function to enqueue experts for indexing when created/updated';

-- ============================================================================
-- Create trigger on experts table
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_index_expert_to_content_embeddings ON experts;

-- Create trigger for expert indexing
CREATE TRIGGER auto_index_expert_to_content_embeddings
AFTER INSERT OR UPDATE OF 
  expertise_area, 
  bio, 
  resume_skills, 
  resume_education, 
  resume_experience,
  is_active
ON experts
FOR EACH ROW
EXECUTE FUNCTION trigger_expert_content_indexing();

COMMENT ON TRIGGER auto_index_expert_to_content_embeddings ON experts IS 
  'Automatically enqueues expert for indexing to content_embeddings when profile is created or updated';

-- ============================================================================
-- RLS Policies for indexing queue
-- ============================================================================

ALTER TABLE content_indexing_queue ENABLE ROW LEVEL SECURITY;

-- Service role can manage queue
CREATE POLICY "Service role can manage indexing queue"
ON content_indexing_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to view queue status (optional, can remove if not needed)
CREATE POLICY "Authenticated users can view queue"
ON content_indexing_queue FOR SELECT
TO authenticated
USING (true);

