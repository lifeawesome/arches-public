-- Circle Content Votes (Upvotes / Likes)
-- Tracks per-user upvotes on circle_content rows.
-- Triggers maintain circle_content.like_count automatically.
-- RLS mirrors the access model: anyone who can access the circle can upvote.

-- ============================================================================
-- TABLE: circle_content_votes
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_content_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES circle_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_content_votes_content_id ON circle_content_votes(content_id);
CREATE INDEX IF NOT EXISTS idx_circle_content_votes_user_id ON circle_content_votes(user_id);

COMMENT ON TABLE circle_content_votes IS
  'One row per user per content item representing an upvote/like. Triggers keep circle_content.like_count in sync.';

-- ============================================================================
-- TRIGGERS to maintain circle_content.like_count
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_content_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE circle_content
  SET like_count = like_count + 1
  WHERE id = NEW.content_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_content_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE circle_content
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.content_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_circle_content_votes_insert
  AFTER INSERT ON circle_content_votes
  FOR EACH ROW EXECUTE FUNCTION increment_content_like_count();

CREATE TRIGGER trg_circle_content_votes_delete
  AFTER DELETE ON circle_content_votes
  FOR EACH ROW EXECUTE FUNCTION decrement_content_like_count();

COMMENT ON FUNCTION increment_content_like_count() IS
  'Increments circle_content.like_count when a vote is inserted.';
COMMENT ON FUNCTION decrement_content_like_count() IS
  'Decrements circle_content.like_count (floor 0) when a vote is deleted.';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE circle_content_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: user can view votes on content they can access
-- Uses is_circle_member() / is_circle_owner() helpers to avoid recursion.
CREATE POLICY "Users can view votes on accessible content" ON circle_content_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.is_published = TRUE
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

-- INSERT: authenticated user can vote on content they can access (one per content per user enforced by UNIQUE)
CREATE POLICY "Members can upvote content" ON circle_content_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.is_published = TRUE
        AND (
          cc.is_free = TRUE
          OR is_circle_owner(cc.circle_id)
          OR is_circle_member(cc.circle_id)
        )
    )
  );

-- DELETE: users can only remove their own votes
CREATE POLICY "Users can remove their own upvotes" ON circle_content_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
