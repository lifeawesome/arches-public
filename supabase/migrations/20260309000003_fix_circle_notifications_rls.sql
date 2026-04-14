-- Fix Circle notification triggers to work correctly with RLS
-- Root cause: notify_circle_post_created() ran as the invoking user under RLS,
-- so a non-owner author could not see other members' circle_memberships rows.
-- The SELECT in the trigger function therefore returned no members and
-- produced no notification_events, even though the logic was correct.
--
-- This migration recreates notify_circle_post_created() as SECURITY DEFINER
-- so it can see all active memberships for the circle and fan out
-- circle_post_created notifications as intended.

CREATE OR REPLACE FUNCTION notify_circle_post_created()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_prefs  RECORD;
  v_owner_id UUID;
  v_owner_has_membership BOOLEAN;
BEGIN
  -- Only notify for published, non-draft content
  IF NEW.is_published IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  -- Load circle owner (expert)
  SELECT expert_id INTO v_owner_id
  FROM circles
  WHERE id = NEW.circle_id;

  -- Notify all active members except the author
  FOR v_member IN
    SELECT cm.user_id
    FROM circle_memberships cm
    WHERE cm.circle_id = NEW.circle_id
      AND cm.status = 'active'
      AND cm.user_id IS NOT NULL
      AND cm.user_id <> NEW.author_id
  LOOP
    SELECT *
    INTO v_prefs
    FROM get_effective_circle_notification_prefs(v_member.user_id, NEW.circle_id)
    LIMIT 1;

    IF v_prefs.notify_posts THEN
      PERFORM create_notification_event(
        v_member.user_id,
        'circle_post_created',
        'New circle post',
        NEW.title,
        jsonb_build_object(
          'circle_id', NEW.circle_id,
          'content_id', NEW.id,
          'title', NEW.title,
          'author_id', NEW.author_id
        ),
        format('/circles/%s/posts/%s', NEW.circle_id, NEW.id),
        'normal',
        NULL,
        ARRAY['in_app']::TEXT[]
      );
    END IF;
  END LOOP;

  -- Also notify the circle owner (expert) if:
  -- - owner exists
  -- - owner is not the author
  -- - owner does NOT already have an active membership (to avoid double notify)
  IF v_owner_id IS NOT NULL AND v_owner_id <> NEW.author_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM circle_memberships cm
      WHERE cm.circle_id = NEW.circle_id
        AND cm.user_id = v_owner_id
        AND cm.status = 'active'
    )
    INTO v_owner_has_membership;

    IF NOT COALESCE(v_owner_has_membership, FALSE) THEN
      SELECT *
      INTO v_prefs
      FROM get_effective_circle_notification_prefs(v_owner_id, NEW.circle_id)
      LIMIT 1;

      IF v_prefs.notify_posts THEN
        PERFORM create_notification_event(
          v_owner_id,
          'circle_post_created',
          'New circle post',
          NEW.title,
          jsonb_build_object(
            'circle_id', NEW.circle_id,
            'content_id', NEW.id,
            'title', NEW.title,
            'author_id', NEW.author_id
          ),
          format('/circles/%s/posts/%s', NEW.circle_id, NEW.id),
          'normal',
          NULL,
          ARRAY['in_app']::TEXT[]
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

