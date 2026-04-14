-- Circle soft delete: is_deleted, deleted_at, deleted_by on content and comments
-- RLS: exclude soft-deleted from public/member views; moderators see all
-- comment_count: trigger handles UPDATE when is_deleted flips

-- ============================================================================
-- 1) circle_content: soft delete columns
-- ============================================================================

ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN circle_content.is_deleted IS 'Soft delete flag; when true row is hidden from feed.';
COMMENT ON COLUMN circle_content.deleted_at IS 'When the content was soft-deleted.';
COMMENT ON COLUMN circle_content.deleted_by IS 'User id of moderator/owner who soft-deleted (or author if self-deleted).';

CREATE INDEX IF NOT EXISTS idx_circle_content_soft_delete
  ON circle_content (circle_id, is_deleted);

-- ============================================================================
-- 2) circle_comments: soft delete columns
-- ============================================================================

ALTER TABLE circle_comments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN circle_comments.is_deleted IS 'Soft delete flag; when true comment is hidden.';
COMMENT ON COLUMN circle_comments.deleted_at IS 'When the comment was soft-deleted.';
COMMENT ON COLUMN circle_comments.deleted_by IS 'User id of moderator/owner who soft-deleted (or author).';

CREATE INDEX IF NOT EXISTS idx_circle_comments_soft_delete
  ON circle_comments (content_id, is_deleted);

-- ============================================================================
-- 3) RLS: content SELECT policies must exclude soft-deleted for feed
--    (Moderators and authors policies unchanged; they already see "all" or "own")
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view free approved content" ON circle_content;
CREATE POLICY "Anyone can view free approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND (is_deleted = FALSE OR is_deleted IS NULL)
    AND is_free = TRUE
  );

DROP POLICY IF EXISTS "Circle members can view approved content" ON circle_content;
CREATE POLICY "Circle members can view approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND (is_deleted = FALSE OR is_deleted IS NULL)
    AND (can_access_circle(circle_id) OR is_free = TRUE)
  );

-- Moderators can view all content (including soft-deleted) - already exists, no change
-- Authors can view their own - already exists, no change

-- ============================================================================
-- 4) RLS: comment SELECT - exclude soft-deleted for normal view; add moderator view
-- ============================================================================

DROP POLICY IF EXISTS "Circle members can view comments on accessible content" ON circle_comments;
CREATE POLICY "Circle members can view comments on accessible content" ON circle_comments
  FOR SELECT USING (
    (is_deleted = FALSE OR is_deleted IS NULL)
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_comments.content_id
        AND (can_access_circle(cc.circle_id) OR cc.is_free = TRUE)
    )
  );

-- Moderators and owners can view all comments in their circle (including soft-deleted)
CREATE POLICY "Moderators can view all comments in their circle" ON circle_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_comments.content_id
        AND is_circle_moderator(cc.circle_id)
    )
  );

-- ============================================================================
-- 5) comment_count trigger: handle INSERT, DELETE, and UPDATE (is_deleted change)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_content_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circle_content
    SET comment_count = comment_count + 1
    WHERE id = NEW.content_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circle_content
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.content_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
      IF NEW.is_deleted = TRUE THEN
        UPDATE circle_content
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = NEW.content_id;
      ELSE
        UPDATE circle_content
        SET comment_count = comment_count + 1
        WHERE id = NEW.content_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_content_comment_count ON circle_comments;
CREATE TRIGGER trigger_update_content_comment_count
  AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON circle_comments
  FOR EACH ROW EXECUTE FUNCTION update_content_comment_count();
