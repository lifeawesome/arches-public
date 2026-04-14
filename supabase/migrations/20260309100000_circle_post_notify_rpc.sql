-- RPC to notify circle members of a new post (callable from API after insert).
-- Uses SECURITY DEFINER so it can read all circle_memberships and create
-- notification_events for each member (respecting per-circle prefs).
-- Use this when the trigger may not run with sufficient privileges.

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
      AND cm.user_id <> v_content.author_id
  LOOP
    SELECT *
    INTO v_prefs
    FROM get_effective_circle_notification_prefs(v_member.user_id, v_content.circle_id)
    LIMIT 1;

    IF COALESCE(v_prefs.notify_posts, true) THEN
      PERFORM create_notification_event(
        v_member.user_id,
        'circle_post_created',
        'New circle post',
        v_content.title,
        jsonb_build_object(
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
    END IF;
  END LOOP;
END;
$$;

-- Allow authenticated users (API) to call this RPC
GRANT EXECUTE ON FUNCTION notify_circle_members_of_new_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_circle_members_of_new_post(UUID) TO service_role;

COMMENT ON FUNCTION notify_circle_members_of_new_post(UUID) IS 'Notifies all circle members (except author) of a new post. Call from API after inserting circle_content. SECURITY DEFINER.';
