-- Circle mentions + public username for @ resolution (Issue #136)

-- 1) Username on profiles (nullable; unique case-insensitive when set)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format CHECK (
    username IS NULL
    OR (
      length(trim(username)) >= 3
      AND length(trim(username)) <= 30
      AND username ~ '^[a-zA-Z0-9_]+$'
    )
  );

DROP INDEX IF EXISTS idx_profiles_username_lower;
CREATE UNIQUE INDEX idx_profiles_username_lower
  ON public.profiles (lower(trim(username)))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN public.profiles.username IS
  'Public handle for @mentions in Circles; unique case-insensitive when set.';

-- Resolve @handles to profile ids (case-insensitive; used by mention sync)
CREATE OR REPLACE FUNCTION public.resolve_profile_usernames(p_handles TEXT[])
RETURNS TABLE(id UUID, username TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.username
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND lower(trim(p.username)) IN (
      SELECT lower(trim(h)) FROM unnest(p_handles) AS handles(h)
    );
$$;

REVOKE ALL ON FUNCTION public.resolve_profile_usernames(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profile_usernames(TEXT[]) TO service_role;

-- 2) circle_mentions
CREATE TABLE IF NOT EXISTS public.circle_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.circle_content(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.circle_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circle_mentions_exactly_one_target CHECK (
    (content_id IS NOT NULL AND comment_id IS NULL)
    OR (content_id IS NULL AND comment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_circle_mentions_circle_id ON public.circle_mentions(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_mentions_content_id ON public.circle_mentions(content_id);
CREATE INDEX IF NOT EXISTS idx_circle_mentions_comment_id ON public.circle_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_circle_mentions_mentioned_user_id ON public.circle_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_circle_mentions_mentioned_by ON public.circle_mentions(mentioned_by);

COMMENT ON TABLE public.circle_mentions IS
  'Resolved @mentions on circle posts (content_id) or comments (comment_id). circle_id is supplied by the app and must match the parent content row.';

ALTER TABLE public.circle_mentions ENABLE ROW LEVEL SECURITY;

-- SELECT: mentioned user, author, or anyone who can access the circle and see approved parent content
CREATE POLICY "circle_mentions_select_participants_and_viewers"
  ON public.circle_mentions
  FOR SELECT
  TO authenticated
  USING (
    mentioned_user_id = auth.uid()
    OR mentioned_by = auth.uid()
    OR (
      public.can_access_circle(circle_id)
      AND EXISTS (
        SELECT 1
        FROM public.circle_content cc
        WHERE
          (
            cc.id = circle_mentions.content_id
            OR cc.id = (
              SELECT cm.content_id
              FROM public.circle_comments cm
              WHERE cm.id = circle_mentions.comment_id
            )
          )
          AND cc.approval_status = 'approved'
          AND (cc.is_deleted = FALSE OR cc.is_deleted IS NULL)
      )
    )
  );

-- Writes are performed by service_role from API routes only (no INSERT/UPDATE/DELETE for authenticated)

-- 3) Notify mentioned user (SECURITY DEFINER; uses create_notification_event + circle prefs)
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

REVOKE ALL ON FUNCTION public.notify_circle_user_mentioned(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_circle_user_mentioned(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.notify_circle_user_mentioned IS
  'Creates a circle_user_mentioned in-app notification when prefs allow; idempotent via notification_key.';
