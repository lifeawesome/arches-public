-- Fix notify_circle_user_mentioned: format() had 4 %s placeholders but only 3 arguments,
-- which caused every RPC call to fail before create_notification_event ran.

CREATE OR REPLACE FUNCTION public.notify_circle_user_mentioned(
  p_circle_id UUID,
  p_content_id UUID,
  p_comment_id UUID,
  p_mentioned_user_id UUID,
  p_mentioned_by UUID,
  p_mention_username TEXT,
  p_action_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notify_mentions BOOLEAN;
  v_key TEXT;
  v_title TEXT;
  v_message TEXT;
  v_nid UUID;
BEGIN
  IF p_mentioned_user_id = p_mentioned_by THEN
    RETURN;
  END IF;

  SELECT p.notify_mentions
  INTO v_notify_mentions
  FROM public.get_effective_circle_notification_prefs(p_mentioned_user_id, p_circle_id) AS p
  LIMIT 1;

  IF COALESCE(v_notify_mentions, TRUE) IS NOT TRUE THEN
    RETURN;
  END IF;

  v_key := format(
    'circle_user_mentioned:%s:%s:%s',
    COALESCE(p_content_id::TEXT, ''),
    COALESCE(p_comment_id::TEXT, ''),
    p_mentioned_user_id
  );

  v_title := 'You were mentioned';
  v_message := format('@%s mentioned you', p_mention_username);

  v_nid := public.create_notification_event(
    p_mentioned_user_id,
    'circle_user_mentioned'::public.notification_event_type,
    v_title,
    v_message,
    jsonb_build_object(
      'notification_key', v_key,
      'circle_id', p_circle_id,
      'content_id', p_content_id,
      'comment_id', p_comment_id,
      'mentioned_by', p_mentioned_by,
      'mention_username', p_mention_username
    ),
    p_action_url,
    'normal',
    NULL,
    ARRAY['in_app']::TEXT[]
  );

  IF v_nid IS NULL THEN
    RETURN;
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

COMMENT ON FUNCTION public.notify_circle_user_mentioned IS
  'Creates a circle_user_mentioned in-app notification when prefs allow; idempotent via notification_key.';
