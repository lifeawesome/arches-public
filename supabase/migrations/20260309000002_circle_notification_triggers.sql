-- Circle Notification Triggers
-- Uses create_notification_event and circle_notification_preferences to fan out Circle activity notifications.

-- Helper: get effective per-circle prefs for a target user
CREATE OR REPLACE FUNCTION get_effective_circle_notification_prefs(
  p_user_id UUID,
  p_circle_id UUID
)
RETURNS TABLE (
  notify_posts BOOLEAN,
  notify_comments BOOLEAN,
  notify_mentions BOOLEAN,
  notify_membership BOOLEAN,
  notify_reactions BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(cnp.notify_posts, TRUE),
    COALESCE(cnp.notify_comments, TRUE),
    COALESCE(cnp.notify_mentions, TRUE),
    COALESCE(cnp.notify_membership, FALSE),
    COALESCE(cnp.notify_reactions, FALSE)
  FROM circle_notification_preferences cnp
  WHERE cnp.user_id = p_user_id
    AND cnp.circle_id = p_circle_id;

  -- If no row, fall back to defaults (all on except membership/reactions)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT TRUE, TRUE, TRUE, FALSE, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Circle post created -> notify circle members
CREATE OR REPLACE FUNCTION notify_circle_post_created()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_prefs  RECORD;
BEGIN
  -- Only notify for published, non-draft content
  IF NEW.is_published IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_circle_post_created
  AFTER INSERT ON circle_content
  FOR EACH ROW
  EXECUTE FUNCTION notify_circle_post_created();

-- Circle comment created -> notify post author
CREATE OR REPLACE FUNCTION notify_circle_comment_created()
RETURNS TRIGGER AS $$
DECLARE
  v_content circle_content;
  v_prefs   RECORD;
BEGIN
  SELECT * INTO v_content FROM circle_content WHERE id = NEW.content_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_content.author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_prefs
  FROM get_effective_circle_notification_prefs(v_content.author_id, v_content.circle_id)
  LIMIT 1;

  IF v_prefs.notify_comments THEN
    PERFORM create_notification_event(
      v_content.author_id,
      'circle_comment_created',
      'New comment on your circle post',
      NEW.comment_text,
      jsonb_build_object(
        'circle_id', v_content.circle_id,
        'content_id', v_content.id,
        'comment_id', NEW.id,
        'author_id', NEW.user_id
      ),
      format('/circles/%s/posts/%s', v_content.circle_id, v_content.id),
      'normal',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_circle_comment_created
  AFTER INSERT ON circle_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_circle_comment_created();

-- NOTE: Additional triggers for approvals, rejections, mentions, membership and reactions
-- can follow the same pattern and be added incrementally as the corresponding
-- Circle features (approval workflow, mentions, votes) are implemented.

