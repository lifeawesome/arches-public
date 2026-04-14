-- Share-to-Circle: attribution columns, share analytics, RLS for shared rows

-- ============================================================================
-- 1) circle_content.shared_from / shared_by
-- ============================================================================

ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS shared_from JSONB,
  ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN circle_content.shared_from IS
  'When set, this row is a share. JSON payload: circle_content ref or external url + optional preview snapshot.';
COMMENT ON COLUMN circle_content.shared_by IS
  'User who shared into the circle; set together with shared_from.';

ALTER TABLE circle_content
  DROP CONSTRAINT IF EXISTS circle_content_shared_from_by_pair;

ALTER TABLE circle_content
  ADD CONSTRAINT circle_content_shared_from_by_pair CHECK (
    (shared_from IS NULL AND shared_by IS NULL)
    OR (shared_from IS NOT NULL AND shared_by IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_circle_content_shared_from_kind
  ON circle_content ((shared_from->>'kind'))
  WHERE shared_from IS NOT NULL;

-- ============================================================================
-- 2) Share insert permission helper (who_can_share vs who_can_post)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.circle_shared_content_insert_allowed(p_circle_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s jsonb;
  who_share text;
  who_post text;
  allow_member_posts boolean;
  is_owner boolean;
  is_mod boolean;
  is_mem boolean;
BEGIN
  SELECT c.settings, (c.expert_id = p_user_id)
  INTO s, is_owner
  FROM circles c
  WHERE c.id = p_circle_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF is_owner THEN
    RETURN true;
  END IF;

  who_share := COALESCE(s->>'who_can_share', 'same_as_post');
  who_post := s->>'who_can_post';
  allow_member_posts := COALESCE((s->>'allow_member_posts')::boolean, false);

  is_mod := is_circle_moderator(p_circle_id);
  is_mem := is_circle_member(p_circle_id);

  IF who_share = 'all_members' THEN
    RETURN is_mem;
  END IF;

  IF who_share = 'moderators_only' THEN
    RETURN is_mod;
  END IF;

  -- same_as_post: mirror who_can_post / legacy allow_member_posts
  IF who_post = 'all_members' OR allow_member_posts THEN
    RETURN is_mod OR is_mem;
  END IF;

  IF who_post = 'moderators_only' THEN
    RETURN is_mod;
  END IF;

  -- owners_only: only owner (already returned)
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.circle_shared_content_insert_allowed IS
  'True if p_user_id may INSERT a shared row (shared_from set) into p_circle_id. Owners always true.';

-- ============================================================================
-- 3) RLS: normal posts must not use shared_from; shares use helper
-- ============================================================================

DROP POLICY IF EXISTS "Circle members can create content if allowed" ON circle_content;
CREATE POLICY "Circle members can create content if allowed" ON circle_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND shared_from IS NULL
    AND shared_by IS NULL
    AND is_circle_member(circle_id)
    AND EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_content.circle_id
        AND (
          (c.settings->>'who_can_post') = 'all_members'
          OR (c.settings->>'allow_member_posts')::boolean = TRUE
        )
    )
  );

DROP POLICY IF EXISTS "Moderators can create content if required" ON circle_content;
CREATE POLICY "Moderators can create content if required" ON circle_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND shared_from IS NULL
    AND shared_by IS NULL
    AND is_circle_moderator(circle_id)
    AND EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_content.circle_id
        AND (c.settings->>'who_can_post') = 'moderators_only'
    )
  );

DROP POLICY IF EXISTS "Shared circle content insert" ON circle_content;
CREATE POLICY "Shared circle content insert" ON circle_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND shared_by = auth.uid()
    AND shared_from IS NOT NULL
    AND circle_shared_content_insert_allowed(circle_id, auth.uid())
  );

-- ============================================================================
-- 4) Analytics: append-only share events
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_content_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  new_content_id UUID REFERENCES circle_content(id) ON DELETE SET NULL,
  shared_from JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_share_events_circle_created
  ON circle_content_share_events (target_circle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circle_share_events_user_created
  ON circle_content_share_events (user_id, created_at DESC);

COMMENT ON TABLE circle_content_share_events IS
  'Product analytics for Share-to-Circle actions; written by app on successful share.';

ALTER TABLE circle_content_share_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own share events" ON circle_content_share_events;
CREATE POLICY "Users insert own share events" ON circle_content_share_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own share events" ON circle_content_share_events;
CREATE POLICY "Users read own share events" ON circle_content_share_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Moderators read circle share events" ON circle_content_share_events;
CREATE POLICY "Moderators read circle share events" ON circle_content_share_events
  FOR SELECT
  TO authenticated
  USING (is_circle_moderator(target_circle_id));
