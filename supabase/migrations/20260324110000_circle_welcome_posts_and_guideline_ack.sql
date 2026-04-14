-- Circle welcome posts + guideline acknowledgment (Issue #132)
-- - Adds first-class welcome post support on circle_content
-- - Adds per-member guideline acknowledgment table keyed by welcome version

-- 1) circle_content additions
ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS is_welcome_post BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS welcome_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN circle_content.is_welcome_post IS
  'Marks this row as the circle welcome post. At most one active welcome post per circle.';
COMMENT ON COLUMN circle_content.welcome_version IS
  'Monotonic version used to invalidate guideline acknowledgments when welcome content changes.';

-- Ensure only one non-deleted welcome post exists per circle.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_circle_active_welcome_post
  ON circle_content (circle_id)
  WHERE is_welcome_post = TRUE
    AND (is_deleted = FALSE OR is_deleted IS NULL);

CREATE INDEX IF NOT EXISTS idx_circle_content_welcome_lookup
  ON circle_content (circle_id, is_welcome_post, approval_status, created_at DESC);

-- Keep welcome_version in sync when welcome content changes.
CREATE OR REPLACE FUNCTION bump_circle_welcome_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_welcome_post IS TRUE THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.welcome_version IS NULL OR NEW.welcome_version < 1 THEN
        NEW.welcome_version = 1;
      END IF;
    ELSE
      -- Bump version when the welcome body/title materially changes.
      IF (COALESCE(OLD.content, '') IS DISTINCT FROM COALESCE(NEW.content, ''))
         OR (COALESCE(OLD.title, '') IS DISTINCT FROM COALESCE(NEW.title, '')) THEN
        NEW.welcome_version = GREATEST(COALESCE(OLD.welcome_version, 1) + 1, 1);
      END IF;
    END IF;
  ELSE
    NEW.welcome_version = 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bump_circle_welcome_version ON circle_content;
CREATE TRIGGER trigger_bump_circle_welcome_version
  BEFORE INSERT OR UPDATE ON circle_content
  FOR EACH ROW
  EXECUTE FUNCTION bump_circle_welcome_version();

-- 2) Circle-level settings default for acknowledgment gate
ALTER TABLE circles
  ALTER COLUMN settings SET DEFAULT '{
    "allow_member_posts": false,
    "auto_approve_members": true,
    "show_member_list": true,
    "require_introduction": false,
    "requires_approval": false,
    "require_guidelines_ack": false
  }'::jsonb;

UPDATE circles
SET settings = COALESCE(settings, '{}'::jsonb) || '{"require_guidelines_ack": false}'::jsonb
WHERE (settings->>'require_guidelines_ack') IS NULL;

-- 3) Backfill welcome posts from legacy settings.guidelines_markdown
INSERT INTO circle_content (
  circle_id,
  author_id,
  title,
  content,
  content_type,
  is_free,
  is_published,
  is_pinned,
  approval_status,
  is_welcome_post
)
SELECT
  c.id,
  c.expert_id,
  'Welcome',
  trim(c.settings->>'guidelines_markdown'),
  'post'::circle_content_type,
  TRUE,
  TRUE,
  TRUE,
  'approved'::circle_content_approval_status,
  TRUE
FROM circles c
WHERE trim(COALESCE(c.settings->>'guidelines_markdown', '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM circle_content cc
    WHERE cc.circle_id = c.id
      AND cc.is_welcome_post = TRUE
      AND (cc.is_deleted = FALSE OR cc.is_deleted IS NULL)
  );

-- 4) Acknowledgment table
CREATE TABLE IF NOT EXISTS circle_guideline_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  welcome_version INTEGER NOT NULL DEFAULT 1,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

COMMENT ON TABLE circle_guideline_acknowledgments IS
  'Latest guideline/welcome version acknowledged by each member for a circle.';

CREATE INDEX IF NOT EXISTS idx_circle_guideline_ack_circle_user
  ON circle_guideline_acknowledgments (circle_id, user_id);

CREATE TRIGGER trigger_update_circle_guideline_ack_updated_at
  BEFORE UPDATE ON circle_guideline_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

ALTER TABLE circle_guideline_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own guideline ack" ON circle_guideline_acknowledgments;
CREATE POLICY "Users can read their own guideline ack" ON circle_guideline_acknowledgments
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert their own guideline ack" ON circle_guideline_acknowledgments;
CREATE POLICY "Users can upsert their own guideline ack" ON circle_guideline_acknowledgments
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own guideline ack" ON circle_guideline_acknowledgments;
CREATE POLICY "Users can update their own guideline ack" ON circle_guideline_acknowledgments
  FOR UPDATE USING (user_id = auth.uid());
