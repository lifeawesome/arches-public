-- Create work request checkpoints table
-- Inspired by Cline's checkpoint system for save/restore functionality
-- Allows users to undo/redo work request creation phases

CREATE TABLE IF NOT EXISTS work_request_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to work request (nullable for new requests being created)
    work_request_id UUID REFERENCES work_requests(id) ON DELETE CASCADE,
    
    -- Reference to conversation/session
    conversation_id UUID,
    session_id TEXT,
    
    -- User who owns this checkpoint
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Checkpoint phase
    phase TEXT NOT NULL CHECK (phase IN ('gathering', 'breakdown', 'expert_matching', 'review', 'created', 'modified')),
    
    -- Checkpoint number within the session (for ordering)
    checkpoint_number INTEGER NOT NULL DEFAULT 1,
    
    -- State snapshot (JSONB for flexibility)
    state JSONB NOT NULL DEFAULT '{}',
    
    -- What triggered this checkpoint
    trigger_action TEXT NOT NULL CHECK (trigger_action IN (
        'user_input',
        'breakdown_complete', 
        'expert_match_complete',
        'user_approval',
        'work_request_created',
        'manual_save',
        'phase_change'
    )),
    
    -- Description of what changed
    description TEXT,
    
    -- Whether this checkpoint is restorable
    is_restorable BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for checkpoint ordering within a session
    UNIQUE (session_id, checkpoint_number)
);

-- Index for fast lookups
CREATE INDEX idx_work_request_checkpoints_user_id ON work_request_checkpoints(user_id);
CREATE INDEX idx_work_request_checkpoints_session_id ON work_request_checkpoints(session_id);
CREATE INDEX idx_work_request_checkpoints_work_request_id ON work_request_checkpoints(work_request_id);
CREATE INDEX idx_work_request_checkpoints_phase ON work_request_checkpoints(phase);
CREATE INDEX idx_work_request_checkpoints_created_at ON work_request_checkpoints(created_at DESC);

-- Enable RLS
ALTER TABLE work_request_checkpoints ENABLE ROW LEVEL SECURITY;

-- Users can only see their own checkpoints
CREATE POLICY "Users can view own checkpoints"
    ON work_request_checkpoints FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own checkpoints
CREATE POLICY "Users can create own checkpoints"
    ON work_request_checkpoints FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own checkpoints
CREATE POLICY "Users can delete own checkpoints"
    ON work_request_checkpoints FOR DELETE
    USING (auth.uid() = user_id);

-- Function to get the latest checkpoint for a session
CREATE OR REPLACE FUNCTION get_latest_checkpoint(p_session_id TEXT)
RETURNS work_request_checkpoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT *
        FROM work_request_checkpoints
        WHERE session_id = p_session_id
        ORDER BY checkpoint_number DESC
        LIMIT 1
    );
END;
$$;

-- Function to get checkpoint history for a session
CREATE OR REPLACE FUNCTION get_checkpoint_history(
    p_session_id TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS SETOF work_request_checkpoints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM work_request_checkpoints
    WHERE session_id = p_session_id
    ORDER BY checkpoint_number DESC
    LIMIT p_limit;
END;
$$;

-- Function to restore to a specific checkpoint
-- Returns the checkpoint state and marks later checkpoints as non-restorable
CREATE OR REPLACE FUNCTION restore_checkpoint(
    p_checkpoint_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_checkpoint work_request_checkpoints;
    v_session_id TEXT;
    v_checkpoint_number INTEGER;
BEGIN
    -- Get the checkpoint
    SELECT * INTO v_checkpoint
    FROM work_request_checkpoints
    WHERE id = p_checkpoint_id AND user_id = p_user_id;
    
    IF v_checkpoint IS NULL THEN
        RAISE EXCEPTION 'Checkpoint not found or access denied';
    END IF;
    
    v_session_id := v_checkpoint.session_id;
    v_checkpoint_number := v_checkpoint.checkpoint_number;
    
    -- Mark all later checkpoints as non-restorable (they become orphaned)
    UPDATE work_request_checkpoints
    SET is_restorable = false
    WHERE session_id = v_session_id
      AND checkpoint_number > v_checkpoint_number
      AND user_id = p_user_id;
    
    -- Return the checkpoint state
    RETURN jsonb_build_object(
        'id', v_checkpoint.id,
        'phase', v_checkpoint.phase,
        'checkpoint_number', v_checkpoint.checkpoint_number,
        'state', v_checkpoint.state,
        'description', v_checkpoint.description,
        'created_at', v_checkpoint.created_at
    );
END;
$$;

-- Function to clean up old checkpoints (keep last N per session)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(
    p_session_id TEXT,
    p_keep_count INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH checkpoints_to_keep AS (
        SELECT id
        FROM work_request_checkpoints
        WHERE session_id = p_session_id
        ORDER BY checkpoint_number DESC
        LIMIT p_keep_count
    )
    DELETE FROM work_request_checkpoints
    WHERE session_id = p_session_id
      AND id NOT IN (SELECT id FROM checkpoints_to_keep)
      AND is_restorable = false;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- Comment for documentation
COMMENT ON TABLE work_request_checkpoints IS 
'Stores state checkpoints for work request creation flow. Inspired by Cline''s checkpoint system. Allows users to undo/redo phases during work request creation.';
