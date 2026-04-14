-- Circle post notifications v2
-- - Idempotent notification creation (prevents duplicates)
-- - Delivery log for debugging
-- - Trigger calls the SECURITY DEFINER fanout function
-- - Enables Realtime on notification_events

-- 1) Delivery log (kept private via RLS with no policies)
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type notification_event_type NOT NULL,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID,
  content_id UUID,
  notification_id UUID REFERENCES notification_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'skipped_author', 'skipped_prefs', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
-- Intentionally no SELECT policy: this is a server/debug table.

COMMENT ON TABLE notification_deliveries IS 'Internal log of notification fanout decisions for debugging (private).';

-- 2) Idempotency: unique key per (recipient,event_type,notification_key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_idempotency_key
  ON notification_events (user_id, event_type, ((metadata->>'notification_key')))
  WHERE (metadata ? 'notification_key');

COMMENT ON INDEX idx_notification_events_idempotency_key IS
  'Prevents duplicate notifications for the same recipient/event_type/key.';

-- 3) Fanout function (authoritative)
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
  SELECT id, circle_id, author_id, title, is_published
  INTO v_content
  FROM circle_content
  WHERE id = p_content_id;

  IF NOT FOUND OR v_content.is_published IS NOT TRUE THEN
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
      -- Idempotency: already created for this recipient/key
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

GRANT EXECUTE ON FUNCTION notify_circle_members_of_new_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_circle_members_of_new_post(UUID) TO service_role;

COMMENT ON FUNCTION notify_circle_members_of_new_post(UUID) IS
  'Notifies all circle members (except author) of a new post. Idempotent via metadata.notification_key. Logs to notification_deliveries.';

-- 4) Trigger function delegates to authoritative fanout
CREATE OR REPLACE FUNCTION notify_circle_post_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- only published posts
  IF NEW.is_published IS DISTINCT FROM TRUE OR NEW.content_type IS DISTINCT FROM 'post' THEN
    RETURN NEW;
  END IF;

  PERFORM notify_circle_members_of_new_post(NEW.id);
  RETURN NEW;
END;
$$;

-- Replace trigger with a WHEN clause so it only fires for posts
DROP TRIGGER IF EXISTS trigger_notify_circle_post_created ON circle_content;
CREATE TRIGGER trigger_notify_circle_post_created
  AFTER INSERT ON circle_content
  FOR EACH ROW
  WHEN (NEW.content_type = 'post' AND NEW.is_published = TRUE)
  EXECUTE FUNCTION notify_circle_post_created();

-- 5) Enable Realtime for notification_events
ALTER TABLE notification_events REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notification_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

