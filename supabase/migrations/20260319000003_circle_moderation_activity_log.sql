-- Circle moderation activity log: append-only log of moderator/owner actions

DO $$ BEGIN
  CREATE TYPE circle_moderation_action AS ENUM (
    'content_soft_deleted',
    'comment_soft_deleted',
    'user_blocked',
    'user_unblocked',
    'report_resolved',
    'report_dismissed',
    'content_pinned',
    'content_unpinned',
    'content_approved',
    'content_rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE circle_moderation_target_type AS ENUM ('content', 'comment', 'user', 'report');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS circle_moderation_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action circle_moderation_action NOT NULL,
  target_type circle_moderation_target_type NOT NULL,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_moderation_activity_circle_created
  ON circle_moderation_activity_log(circle_id, created_at DESC);

COMMENT ON TABLE circle_moderation_activity_log IS 'Append-only log of moderation actions for circle owners/moderators.';

-- ============================================================================
-- RLS: only moderators/owners can read; insert from app (as actor)
-- ============================================================================

ALTER TABLE circle_moderation_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can view activity log" ON circle_moderation_activity_log
  FOR SELECT
  TO authenticated
  USING (is_circle_moderator(circle_id));

CREATE POLICY "Moderators can insert activity log" ON circle_moderation_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND is_circle_moderator(circle_id)
  );

-- No UPDATE or DELETE policies (append-only)
