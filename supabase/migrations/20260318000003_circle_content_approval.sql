-- Circle content approval workflow
-- - Adds approval_status, approved_by, approved_at, rejection_reason to circle_content
-- - Adds requires_approval to circles.settings
-- - Adjusts RLS so moderators can SELECT pending content for the moderation queue

-- ============================================================================
-- 1) New enum for approval states
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE circle_content_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2) Add approval columns to circle_content
-- ============================================================================

ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS approval_status circle_content_approval_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_by     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN circle_content.approval_status    IS 'Moderation state: pending (awaiting review), approved (visible in feed), rejected (hidden).';
COMMENT ON COLUMN circle_content.approved_by        IS 'User id of the moderator/owner who made the decision.';
COMMENT ON COLUMN circle_content.approved_at        IS 'Timestamp of the approve/reject decision.';
COMMENT ON COLUMN circle_content.rejection_reason   IS 'Optional reason text shown to the author when rejected.';

-- ============================================================================
-- 3) Indexes for moderation queue and feed filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_circle_content_approval
  ON circle_content (circle_id, approval_status, created_at DESC);

COMMENT ON INDEX idx_circle_content_approval IS
  'Supports moderation queue (circle+pending) and feed (circle+approved) queries.';

-- ============================================================================
-- 4) Backfill existing content: keep everything visible
--    All previously published content → approved.
--    Any unpublished content (set via old moderator toggle) → pending.
-- ============================================================================

UPDATE circle_content
  SET approval_status = 'approved'
  WHERE is_published = TRUE;

UPDATE circle_content
  SET approval_status = 'pending'
  WHERE is_published = FALSE;

-- ============================================================================
-- 5) Add requires_approval to circles.settings
-- ============================================================================

ALTER TABLE circles
  ALTER COLUMN settings SET DEFAULT '{
    "allow_member_posts": false,
    "auto_approve_members": true,
    "show_member_list": true,
    "require_introduction": false,
    "requires_approval": false
  }'::jsonb;

-- Backfill existing circles
UPDATE circles
  SET settings = COALESCE(settings, '{}'::jsonb) || '{"requires_approval": false}'::jsonb
  WHERE (settings->>'requires_approval') IS NULL;

-- ============================================================================
-- 6) RLS: update SELECT policies to filter by approval_status
--
-- Strategy:
--   a) Drop the two existing published-only SELECT policies (they checked is_published).
--   b) Re-add equivalent policies checking approval_status = 'approved'.
--   c) Add a new policy: moderators/owners can select ANY content in their circle.
--   d) Add a new policy: authors can always see their own content (pending/rejected/approved).
-- ============================================================================

-- Drop old policies that only checked is_published
DROP POLICY IF EXISTS "Anyone can view free published content" ON circle_content;
DROP POLICY IF EXISTS "Circle members can view all published content" ON circle_content;

-- Free approved content is viewable by anyone (public circles)
CREATE POLICY "Anyone can view free approved content" ON circle_content
  FOR SELECT USING (approval_status = 'approved' AND is_free = TRUE);

-- Circle members can view approved content in circles they have access to
CREATE POLICY "Circle members can view approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND (can_access_circle(circle_id) OR is_free = TRUE)
  );

-- Moderators and owners can view ALL content in their circles (for the moderation queue)
CREATE POLICY "Moderators can view all content in their circle" ON circle_content
  FOR SELECT USING (
    is_circle_moderator(circle_id)
  );

-- Authors can always view their own content regardless of approval state
CREATE POLICY "Authors can view their own content" ON circle_content
  FOR SELECT USING (
    author_id = auth.uid()
  );
