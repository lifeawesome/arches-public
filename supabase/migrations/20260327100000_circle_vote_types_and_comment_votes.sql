-- Issue #135: upvote/downvote on content and comments; aggregate counts; RLS.

-- ============================================================================
-- ENUM: vote direction (shared by content and comment votes)
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE circle_vote_type AS ENUM ('up', 'down');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- circle_content: downvote aggregate
-- ============================================================================

ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS downvote_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN circle_content.downvote_count IS
  'Downvote tally; maintained by triggers on circle_content_votes.';

-- Sort feed by "controversial" (high when both up and down votes exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'circle_content'
      AND column_name = 'vote_controversy_score'
  ) THEN
    ALTER TABLE circle_content
      ADD COLUMN vote_controversy_score INTEGER
      GENERATED ALWAYS AS (LEAST(like_count, downvote_count)) STORED;
  END IF;
END $$;

COMMENT ON COLUMN circle_content.vote_controversy_score IS
  'LEAST(up, down); higher means more controversial. Used for feed sort.';

-- ============================================================================
-- circle_content_votes: vote_type
-- ============================================================================

ALTER TABLE circle_content_votes
  ADD COLUMN IF NOT EXISTS vote_type circle_vote_type NOT NULL DEFAULT 'up';

COMMENT ON COLUMN circle_content_votes.vote_type IS 'up or down; one row per user per content.';

COMMENT ON TABLE circle_content_votes IS
  'Per-user vote on circle content. Triggers keep like_count (upvotes) and downvote_count in sync.';

-- ============================================================================
-- Replace content vote triggers (INSERT/UPDATE/DELETE with vote_type)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_circle_content_votes_insert ON circle_content_votes;
DROP TRIGGER IF EXISTS trg_circle_content_votes_delete ON circle_content_votes;

DROP FUNCTION IF EXISTS increment_content_like_count();
DROP FUNCTION IF EXISTS decrement_content_like_count();

CREATE OR REPLACE FUNCTION apply_circle_content_vote_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    cid := NEW.content_id;
    IF NEW.vote_type = 'up' THEN
      UPDATE circle_content SET like_count = like_count + 1 WHERE id = cid;
    ELSE
      UPDATE circle_content SET downvote_count = downvote_count + 1 WHERE id = cid;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    cid := OLD.content_id;
    IF OLD.vote_type = 'up' THEN
      UPDATE circle_content SET like_count = GREATEST(like_count - 1, 0) WHERE id = cid;
    ELSE
      UPDATE circle_content SET downvote_count = GREATEST(downvote_count - 1, 0) WHERE id = cid;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type IS NOT DISTINCT FROM NEW.vote_type THEN
      RETURN NEW;
    END IF;
    cid := NEW.content_id;
    IF OLD.vote_type = 'up' AND NEW.vote_type = 'down' THEN
      UPDATE circle_content
      SET like_count = GREATEST(like_count - 1, 0), downvote_count = downvote_count + 1
      WHERE id = cid;
    ELSIF OLD.vote_type = 'down' AND NEW.vote_type = 'up' THEN
      UPDATE circle_content
      SET downvote_count = GREATEST(downvote_count - 1, 0), like_count = like_count + 1
      WHERE id = cid;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_circle_content_votes_apply
  AFTER INSERT OR UPDATE OR DELETE ON circle_content_votes
  FOR EACH ROW EXECUTE FUNCTION apply_circle_content_vote_delta();

COMMENT ON FUNCTION apply_circle_content_vote_delta() IS
  'Keeps circle_content.like_count and downvote_count in sync with circle_content_votes.';

-- ============================================================================
-- circle_comments: downvote aggregate
-- ============================================================================

ALTER TABLE circle_comments
  ADD COLUMN IF NOT EXISTS downvote_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN circle_comments.downvote_count IS
  'Downvote tally; maintained by triggers on circle_comment_votes.';

-- ============================================================================
-- TABLE: circle_comment_votes
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES circle_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type circle_vote_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_comment_votes_comment_id ON circle_comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_circle_comment_votes_user_id ON circle_comment_votes(user_id);

COMMENT ON TABLE circle_comment_votes IS
  'Per-user vote on circle comments. Triggers keep like_count and downvote_count on circle_comments.';

CREATE OR REPLACE FUNCTION apply_circle_comment_vote_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmt_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    cmt_id := NEW.comment_id;
    IF NEW.vote_type = 'up' THEN
      UPDATE circle_comments SET like_count = like_count + 1 WHERE id = cmt_id;
    ELSE
      UPDATE circle_comments SET downvote_count = downvote_count + 1 WHERE id = cmt_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    cmt_id := OLD.comment_id;
    IF OLD.vote_type = 'up' THEN
      UPDATE circle_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = cmt_id;
    ELSE
      UPDATE circle_comments SET downvote_count = GREATEST(downvote_count - 1, 0) WHERE id = cmt_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type IS NOT DISTINCT FROM NEW.vote_type THEN
      RETURN NEW;
    END IF;
    cmt_id := NEW.comment_id;
    IF OLD.vote_type = 'up' AND NEW.vote_type = 'down' THEN
      UPDATE circle_comments
      SET like_count = GREATEST(like_count - 1, 0), downvote_count = downvote_count + 1
      WHERE id = cmt_id;
    ELSIF OLD.vote_type = 'down' AND NEW.vote_type = 'up' THEN
      UPDATE circle_comments
      SET downvote_count = GREATEST(downvote_count - 1, 0), like_count = like_count + 1
      WHERE id = cmt_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_circle_comment_votes_apply ON circle_comment_votes;
CREATE TRIGGER trg_circle_comment_votes_apply
  AFTER INSERT OR UPDATE OR DELETE ON circle_comment_votes
  FOR EACH ROW EXECUTE FUNCTION apply_circle_comment_vote_delta();

-- ============================================================================
-- RLS: tighten circle_content_votes + UPDATE policy + approval
-- ============================================================================

DROP POLICY IF EXISTS "Users can view votes on accessible content" ON circle_content_votes;
DROP POLICY IF EXISTS "Members can upvote content" ON circle_content_votes;
DROP POLICY IF EXISTS "Users can remove their own upvotes" ON circle_content_votes;

-- Visible when user can see the underlying content (approved or moderator path)
CREATE POLICY "Users can view votes on accessible content" ON circle_content_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.is_published = TRUE
        AND (
          cc.approval_status = 'approved'
          OR is_circle_moderator(cc.circle_id)
        )
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

CREATE POLICY "Members can insert content votes" ON circle_content_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.is_published = TRUE
        AND (
          cc.approval_status = 'approved'
          OR is_circle_moderator(cc.circle_id)
        )
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

CREATE POLICY "Users can update own content votes" ON circle_content_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.is_published = TRUE
        AND (
          cc.approval_status = 'approved'
          OR is_circle_moderator(cc.circle_id)
        )
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

CREATE POLICY "Users can delete own content votes" ON circle_content_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- RLS: circle_comment_votes
-- ============================================================================

ALTER TABLE circle_comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view votes on accessible comments" ON circle_comment_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM circle_comments c
      JOIN circle_content cc ON cc.id = c.content_id
      WHERE c.id = circle_comment_votes.comment_id
        AND cc.is_published = TRUE
        AND (
          cc.approval_status = 'approved'
          OR is_circle_moderator(cc.circle_id)
        )
        AND (c.is_deleted = FALSE OR c.is_deleted IS NULL OR is_circle_moderator(cc.circle_id))
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

CREATE POLICY "Members can insert comment votes" ON circle_comment_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM circle_comments c
      JOIN circle_content cc ON cc.id = c.content_id
      WHERE c.id = circle_comment_votes.comment_id
        AND cc.is_published = TRUE
        AND (
          cc.approval_status = 'approved'
          OR is_circle_moderator(cc.circle_id)
        )
        AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

CREATE POLICY "Users can update own comment votes" ON circle_comment_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM circle_comments c
      JOIN circle_content cc ON cc.id = c.content_id
      WHERE c.id = circle_comment_votes.comment_id
        AND cc.is_published = TRUE
        AND (
          cc.approval_status = 'approved'
          OR is_circle_moderator(cc.circle_id)
        )
        AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

CREATE POLICY "Users can delete own comment votes" ON circle_comment_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
