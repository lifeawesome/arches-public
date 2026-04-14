-- Issue #137: Drafts and scheduled publishing for circle_content
-- Adds publication_status + scheduled_for, tightens RLS, votes, comments, triggers.

-- ============================================================================
-- 1) Enum + columns
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE circle_content_publication_status AS ENUM ('draft', 'scheduled', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS publication_status circle_content_publication_status NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

COMMENT ON COLUMN circle_content.publication_status IS
  'draft / scheduled (not yet live) / published (visible per approval + feed rules).';
COMMENT ON COLUMN circle_content.scheduled_for IS
  'When status = scheduled, time the post should go live; cleared when published.';

-- Drafts / scheduled rows are not yet published; keep timestamp only when live.
ALTER TABLE circle_content ALTER COLUMN published_at DROP NOT NULL;

UPDATE circle_content SET publication_status = 'published' WHERE publication_status IS NULL;
UPDATE circle_content SET scheduled_for = NULL WHERE publication_status <> 'scheduled';

ALTER TABLE circle_content DROP CONSTRAINT IF EXISTS circle_content_scheduled_consistency;
ALTER TABLE circle_content ADD CONSTRAINT circle_content_scheduled_consistency CHECK (
  (publication_status = 'scheduled' AND scheduled_for IS NOT NULL)
  OR (publication_status <> 'scheduled' AND scheduled_for IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_circle_content_scheduled_for_due
  ON circle_content (scheduled_for ASC)
  WHERE publication_status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_circle_content_author_drafts
  ON circle_content (author_id, circle_id, publication_status, updated_at DESC);

-- ============================================================================
-- 2) SELECT policies: only published rows in public/member feeds
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view free approved content" ON circle_content;
CREATE POLICY "Anyone can view free approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND publication_status = 'published'
    AND (is_deleted = FALSE OR is_deleted IS NULL)
    AND is_free = TRUE
    AND NOT is_blocked_from_circle(circle_id)
  );

DROP POLICY IF EXISTS "Circle members can view approved content" ON circle_content;
CREATE POLICY "Circle members can view approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND publication_status = 'published'
    AND (is_deleted = FALSE OR is_deleted IS NULL)
    AND (
      can_access_circle(circle_id)
      OR (is_free = TRUE AND NOT is_blocked_from_circle(circle_id))
    )
  );

-- Moderators: all circle content except other members' drafts/scheduled (author-only)
DROP POLICY IF EXISTS "Moderators can view all content in their circle" ON circle_content;
CREATE POLICY "Moderators can view all content in their circle" ON circle_content
  FOR SELECT USING (
    is_circle_moderator(circle_id)
    AND NOT (
      publication_status IN ('draft', 'scheduled')
      AND author_id IS DISTINCT FROM auth.uid()
    )
  );

-- ============================================================================
-- 3) Comments: cannot comment on non-published content; view paths unchanged for feed
-- ============================================================================

DROP POLICY IF EXISTS "Circle members can create comments" ON circle_comments;
CREATE POLICY "Circle members can create comments" ON circle_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_comments.content_id
        AND cc.publication_status = 'published'
        AND can_access_circle(cc.circle_id)
    )
  );

-- ============================================================================
-- 4) circle_content_votes: require published content
-- ============================================================================

DROP POLICY IF EXISTS "Users can view votes on accessible content" ON circle_content_votes;
CREATE POLICY "Users can view votes on accessible content" ON circle_content_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.publication_status = 'published'
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

DROP POLICY IF EXISTS "Members can insert content votes" ON circle_content_votes;
CREATE POLICY "Members can insert content votes" ON circle_content_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.publication_status = 'published'
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

DROP POLICY IF EXISTS "Users can update own content votes" ON circle_content_votes;
CREATE POLICY "Users can update own content votes" ON circle_content_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_content_votes.content_id
        AND cc.publication_status = 'published'
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

-- ============================================================================
-- 5) View count RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_circle_content_view_count(
  p_circle_id uuid,
  p_content_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated int;
BEGIN
  UPDATE circle_content
  SET
    view_count = COALESCE(view_count, 0) + 1,
    updated_at = now()
  WHERE id = p_content_id
    AND circle_id = p_circle_id
    AND publication_status = 'published'
    AND approval_status = 'approved'
    AND is_published = TRUE
    AND (is_deleted IS NOT TRUE OR is_deleted IS NULL);

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

-- ============================================================================
-- 6) Notifications: only when post is published (not draft/scheduled)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_circle_members_of_new_post(p_content_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content RECORD;
  v_member RECORD;
  v_prefs  RECORD;
  v_key TEXT;
  v_notification_id UUID;
BEGIN
  SELECT id, circle_id, author_id, title, is_published, publication_status
  INTO v_content
  FROM circle_content
  WHERE id = p_content_id;

  IF NOT FOUND
     OR v_content.is_published IS NOT TRUE
     OR v_content.publication_status IS DISTINCT FROM 'published'
  THEN
    RETURN;
  END IF;

  FOR v_member IN
    SELECT cm.user_id
    FROM circle_memberships cm
    WHERE cm.circle_id = v_content.circle_id
      AND cm.status = 'active'
      AND cm.user_id IS NOT NULL
  LOOP
    BEGIN
      IF v_member.user_id = v_content.author_id THEN
        INSERT INTO notification_deliveries (
          event_type, recipient_user_id, circle_id, content_id, status
        ) VALUES (
          'circle_post_created', v_member.user_id, v_content.circle_id, v_content.id, 'skipped_author'
        );
        CONTINUE;
      END IF;

      SELECT *
      INTO v_prefs
      FROM get_effective_circle_notification_prefs(v_member.user_id, v_content.circle_id)
      LIMIT 1;

      IF COALESCE(v_prefs.notify_posts, TRUE) IS NOT TRUE THEN
        INSERT INTO notification_deliveries (
          event_type, recipient_user_id, circle_id, content_id, status
        ) VALUES (
          'circle_post_created', v_member.user_id, v_content.circle_id, v_content.id, 'skipped_prefs'
        );
        CONTINUE;
      END IF;

      v_key := format('circle_post_created:%s:%s', v_content.id, v_member.user_id);

      v_notification_id := create_notification_event(
        v_member.user_id,
        'circle_post_created',
        'New circle post',
        v_content.title,
        jsonb_build_object(
          'notification_key', v_key,
          'circle_id', v_content.circle_id,
          'content_id', v_content.id,
          'title', v_content.title,
          'author_id', v_content.author_id
        ),
        format('/circles/%s/posts/%s', v_content.circle_id, v_content.id),
        'normal',
        NULL,
        ARRAY['in_app']::TEXT[]
      );

      IF v_notification_id IS NULL THEN
        INSERT INTO notification_deliveries (
          event_type, recipient_user_id, circle_id, content_id, status
        ) VALUES (
          'circle_post_created', v_member.user_id, v_content.circle_id, v_content.id, 'skipped_prefs'
        );
      ELSE
        INSERT INTO notification_deliveries (
          event_type, recipient_user_id, circle_id, content_id, notification_id, status
        ) VALUES (
          'circle_post_created', v_member.user_id, v_content.circle_id, v_content.id, v_notification_id, 'created'
        );
      END IF;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    WHEN OTHERS THEN
      INSERT INTO notification_deliveries (
        event_type, recipient_user_id, circle_id, content_id, status, error_message
      ) VALUES (
        'circle_post_created', v_member.user_id, v_content.circle_id, v_content.id, 'error', SQLERRM
      );
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION notify_circle_post_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published IS DISTINCT FROM TRUE
     OR NEW.content_type IS DISTINCT FROM 'post'
     OR NEW.publication_status IS DISTINCT FROM 'published'
  THEN
    RETURN NEW;
  END IF;

  PERFORM notify_circle_members_of_new_post(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_circle_post_created ON circle_content;
CREATE TRIGGER trigger_notify_circle_post_created
  AFTER INSERT ON circle_content
  FOR EACH ROW
  WHEN (NEW.content_type = 'post' AND NEW.is_published = TRUE AND NEW.publication_status = 'published')
  EXECUTE FUNCTION notify_circle_post_created();

-- Scheduled publish and moderation approval call notify_circle_members_of_new_post from application code
-- (avoids duplicate fanout vs an UPDATE trigger).
