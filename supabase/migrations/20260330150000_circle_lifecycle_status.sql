-- Issue #138: Circle lifecycle (active | archived | deleted), RLS, search RPCs, membership guards.

-- ============================================================================
-- 1) Enum and columns
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE circle_lifecycle_status AS ENUM ('active', 'archived', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS status circle_lifecycle_status,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: treat legacy is_active = false as archived (owner as archived_by for migration only)
UPDATE circles
SET
  status = CASE WHEN is_active THEN 'active'::circle_lifecycle_status ELSE 'archived'::circle_lifecycle_status END,
  archived_at = CASE WHEN NOT is_active THEN COALESCE(updated_at, created_at) ELSE NULL END,
  archived_by = CASE WHEN NOT is_active THEN expert_id ELSE NULL END,
  deleted_at = NULL,
  deleted_by = NULL
WHERE status IS NULL;

ALTER TABLE circles
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_lifecycle_columns_ok;
ALTER TABLE circles ADD CONSTRAINT circles_lifecycle_columns_ok CHECK (
  (status = 'active' AND archived_at IS NULL AND archived_by IS NULL AND deleted_at IS NULL AND deleted_by IS NULL)
  OR (
    status = 'archived'
    AND archived_at IS NOT NULL
    AND archived_by IS NOT NULL
    AND deleted_at IS NULL
    AND deleted_by IS NULL
  )
  OR (
    status = 'deleted'
    AND deleted_at IS NOT NULL
    AND deleted_by IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_circles_status ON circles (status);

COMMENT ON COLUMN circles.status IS 'Lifecycle: active (directory + joins), archived (hidden, members retain access), deleted (owner-only, content access denied).';
COMMENT ON COLUMN circles.archived_at IS 'When the circle was archived.';
COMMENT ON COLUMN circles.archived_by IS 'User who archived the circle.';
COMMENT ON COLUMN circles.deleted_at IS 'When the circle was soft-deleted.';
COMMENT ON COLUMN circles.deleted_by IS 'User who soft-deleted the circle.';

-- ============================================================================
-- 2) Keep is_active in sync with status (legacy queries)
-- ============================================================================

CREATE OR REPLACE FUNCTION circles_sync_is_active_from_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_circles_sync_is_active_from_status ON circles;
CREATE TRIGGER trigger_circles_sync_is_active_from_status
  BEFORE INSERT OR UPDATE OF status ON circles
  FOR EACH ROW
  EXECUTE FUNCTION circles_sync_is_active_from_status();

-- One-time sync for existing rows
UPDATE circles SET is_active = (status = 'active') WHERE is_active IS DISTINCT FROM (status = 'active');

-- ============================================================================
-- 3) Helper: circle accepts new memberships (active only)
-- ============================================================================

CREATE OR REPLACE FUNCTION circle_accepts_new_members(p_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM circles c
    WHERE c.id = p_circle_id
      AND c.status = 'active'
  );
$$;

COMMENT ON FUNCTION circle_accepts_new_members IS 'True when the circle is active and can accept joins/invites.';

-- ============================================================================
-- 4) can_access_circle: lifecycle (deleted = owner only; archived = members only)
-- ============================================================================

CREATE OR REPLACE FUNCTION can_access_circle(p_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle RECORD;
  v_has_subscription BOOLEAN;
BEGIN
  SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Owner always has access (including deleted, for recovery/settings)
  IF v_circle.expert_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Soft-deleted: non-owners have no access
  IF v_circle.status = 'deleted' THEN
    RETURN FALSE;
  END IF;

  -- Blocked users cannot access the circle
  IF EXISTS (
    SELECT 1 FROM circle_blocked_users
    WHERE circle_id = p_circle_id AND user_id = auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;

  -- Archived: only active members (no public/subscription browse)
  IF v_circle.status = 'archived' THEN
    RETURN is_circle_member(p_circle_id);
  END IF;

  -- Active circle: visibility and access_type
  IF v_circle.visibility = 'private' THEN
    RETURN is_circle_member(p_circle_id);
  END IF;

  IF v_circle.access_type = 'free' THEN
    RETURN TRUE;
  END IF;
  IF v_circle.access_type = 'subscription' THEN
    SELECT EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = auth.uid()
        AND status IN ('active', 'trialing')
    ) INTO v_has_subscription;
    RETURN v_has_subscription;
  END IF;
  IF v_circle.access_type = 'paid' THEN
    RETURN is_circle_member(p_circle_id);
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION can_access_circle IS
  'Access: owner always; deleted denies non-owners; archived allows members only; then blocked check; active uses visibility/access_type.';

-- ============================================================================
-- 5) RLS: circles SELECT — public directory only for active + public + is_active
-- ============================================================================

DROP POLICY IF EXISTS "Public can view active circles" ON circles;

CREATE POLICY "Public can view active circles" ON circles
  FOR SELECT
  TO anon, authenticated
  USING (
    expert_id = auth.uid()
    OR (
      is_circle_member(id)
      AND status <> 'deleted'
      AND NOT EXISTS (
        SELECT 1 FROM circle_blocked_users cbu
        WHERE cbu.circle_id = circles.id
          AND cbu.user_id = auth.uid()
      )
    )
    OR (
      visibility = 'public'
      AND is_active = TRUE
      AND status = 'active'
    )
  );

COMMENT ON POLICY "Public can view active circles" ON circles IS
  'Public listing only for active lifecycle + public visibility; owner and members always see their circles (incl. archived).';

DROP POLICY IF EXISTS "Pending invitees can view circles" ON circles;

CREATE POLICY "Pending invitees can view circles" ON circles
  FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1
      FROM circle_memberships cm
      JOIN profiles p ON p.id = auth.uid()
      WHERE cm.circle_id = circles.id
        AND cm.status = 'pending'
        AND cm.user_id IS NULL
        AND cm.invited_email = p.email
    )
  );

-- ============================================================================
-- 6) RLS: circle_memberships — only active circles for new joins / invites / accept
-- ============================================================================

DROP POLICY IF EXISTS "Users can join circles" ON circle_memberships;
CREATE POLICY "Users can join circles" ON circle_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND circle_accepts_new_members(circle_id)
  );

DROP POLICY IF EXISTS "Owners and moderators can create invitations" ON circle_memberships;
CREATE POLICY "Owners and moderators can create invitations" ON circle_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NULL
    AND status = 'pending'
    AND (is_circle_owner(circle_id) OR is_circle_moderator(circle_id))
    AND circle_accepts_new_members(circle_id)
  );

DROP POLICY IF EXISTS "Users can accept invitation" ON circle_memberships;
CREATE POLICY "Users can accept invitation" ON circle_memberships
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS NULL
    AND invitation_token IS NOT NULL
    AND (invitation_expires_at IS NULL OR invitation_expires_at > now())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND circle_accepts_new_members(circle_id)
  );

-- ============================================================================
-- 7) Moderation log: lifecycle actions + target type "circle"
-- ============================================================================

DO $$ BEGIN
  ALTER TYPE circle_moderation_action ADD VALUE 'circle_archived';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE circle_moderation_action ADD VALUE 'circle_unarchived';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE circle_moderation_action ADD VALUE 'circle_deleted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE circle_moderation_target_type ADD VALUE 'circle';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 8) circle_search — restrict to lifecycle active
-- ============================================================================

DROP FUNCTION IF EXISTS circle_search(
  p_query text,
  p_category_id uuid,
  p_visibility circle_visibility,
  p_min_members integer,
  p_max_members integer,
  p_limit integer,
  p_offset integer
);

CREATE FUNCTION circle_search(
  p_query text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_visibility circle_visibility DEFAULT NULL,
  p_min_members integer DEFAULT NULL,
  p_max_members integer DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  expert_id uuid,
  name text,
  slug text,
  description text,
  cover_image_url text,
  visibility circle_visibility,
  category_id uuid,
  is_featured boolean,
  access_type circle_access_type,
  price_cents integer,
  stripe_product_id text,
  stripe_price_id text,
  is_active boolean,
  member_count integer,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  post_count integer,
  total_view_count integer,
  total_like_count integer,
  score double precision,
  total_count bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH
  q AS (
    SELECT
      NULLIF(trim(coalesce(p_query, '')), '') AS query_text,
      CASE
        WHEN NULLIF(trim(coalesce(p_query, '')), '') IS NULL THEN NULL
        ELSE websearch_to_tsquery('english', trim(p_query))
      END AS tsq
  ),
  content_rank AS (
    SELECT
      cc.circle_id,
      max(ts_rank_cd(cc.search_vector, q.tsq)) AS content_score
    FROM circle_content cc
    CROSS JOIN q
    WHERE q.tsq IS NOT NULL
      AND cc.is_published = TRUE
    GROUP BY cc.circle_id
  ),
  content_stats AS (
    SELECT
      cc.circle_id,
      count(*)::int AS post_count,
      coalesce(sum(cc.view_count), 0)::int AS total_view_count,
      coalesce(sum(cc.like_count), 0)::int AS total_like_count,
      max(cc.created_at) AS last_content_at
    FROM circle_content cc
    WHERE cc.is_published = TRUE
    GROUP BY cc.circle_id
  ),
  ranked AS (
    SELECT
      c.*,
      coalesce(cs.post_count, 0) AS post_count,
      coalesce(cs.total_view_count, 0) AS total_view_count,
      coalesce(cs.total_like_count, 0) AS total_like_count,
      (
        coalesce(ts_rank_cd(c.search_vector, q.tsq), 0) * 2.0
        + coalesce(cr.content_score, 0) * 1.0
        + ln(1 + greatest(c.member_count, 0)) * 0.05
        + ln(1 + greatest(coalesce(cs.total_view_count, 0), 0)) * 0.01
        + ln(1 + greatest(coalesce(cs.total_like_count, 0), 0)) * 0.02
        + (
          CASE
            WHEN cs.last_content_at IS NULL THEN 0
            ELSE exp(-greatest(extract(epoch from (now() - cs.last_content_at)) / 86400.0, 0) / 60.0) * 0.10
          END
        )
      ) AS score
    FROM circles c
    CROSS JOIN q
    LEFT JOIN content_rank cr ON cr.circle_id = c.id
    LEFT JOIN content_stats cs ON cs.circle_id = c.id
    WHERE
      c.is_active = TRUE
      AND c.status = 'active'
      AND (p_category_id IS NULL OR c.category_id = p_category_id)
      AND (p_visibility IS NULL OR c.visibility = p_visibility)
      AND (p_min_members IS NULL OR c.member_count >= p_min_members)
      AND (p_max_members IS NULL OR c.member_count <= p_max_members)
      AND (
        q.tsq IS NULL
        OR c.search_vector @@ q.tsq
        OR (cr.content_score IS NOT NULL AND cr.content_score > 0)
      )
  )
  SELECT
    r.id,
    r.expert_id,
    r.name,
    r.slug,
    r.description,
    r.cover_image_url,
    r.visibility,
    r.category_id,
    r.is_featured,
    r.access_type,
    r.price_cents,
    r.stripe_product_id,
    r.stripe_price_id,
    r.is_active,
    r.member_count,
    r.settings,
    r.created_at,
    r.updated_at,
    r.post_count,
    r.total_view_count,
    r.total_like_count,
    r.score,
    count(*) OVER () AS total_count
  FROM ranked r
  ORDER BY
    CASE WHEN (SELECT tsq FROM q) IS NULL THEN 0 ELSE 1 END DESC,
    r.score DESC,
    r.is_featured DESC,
    r.member_count DESC,
    r.created_at DESC
  LIMIT greatest(1, least(p_limit, 50))
  OFFSET greatest(p_offset, 0);
$$;

COMMENT ON FUNCTION circle_search IS
  'Search circles (active lifecycle only). SECURITY INVOKER.';

-- ============================================================================
-- 9) circle_trending
-- ============================================================================

DROP FUNCTION IF EXISTS circle_trending(p_days integer, p_limit integer);

CREATE FUNCTION circle_trending(
  p_days integer DEFAULT 14,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  circle_id uuid,
  score double precision
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH windowed AS (
    SELECT
      c.id AS circle_id,
      c.member_count,
      count(cc.*)::int AS posts_in_window,
      coalesce(sum(cc.view_count), 0)::int AS views_in_window,
      coalesce(sum(cc.like_count), 0)::int AS likes_in_window,
      max(cc.created_at) AS last_content_at
    FROM circles c
    LEFT JOIN circle_content cc
      ON cc.circle_id = c.id
      AND cc.is_published = TRUE
      AND cc.created_at >= now() - (greatest(p_days, 1) || ' days')::interval
    WHERE
      c.is_active = TRUE
      AND c.status = 'active'
      AND c.visibility = 'public'
    GROUP BY c.id, c.member_count
  )
  SELECT
    w.circle_id,
    (
      ln(1 + greatest(w.posts_in_window, 0)) * 0.45
      + ln(1 + greatest(w.views_in_window, 0)) * 0.25
      + ln(1 + greatest(w.likes_in_window, 0)) * 0.25
      + ln(1 + greatest(w.member_count, 0)) * 0.05
      + (
        CASE
          WHEN w.last_content_at IS NULL THEN 0
          ELSE exp(-greatest(extract(epoch from (now() - w.last_content_at)) / 86400.0, 0) / 14.0) * 0.10
        END
      )
    ) AS score
  FROM windowed w
  ORDER BY score DESC, w.member_count DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;

COMMENT ON FUNCTION circle_trending IS
  'Trending public circles (active lifecycle only). SECURITY INVOKER.';

-- ============================================================================
-- 10) circle_search_suggestions
-- ============================================================================

DROP FUNCTION IF EXISTS circle_search_suggestions(p_prefix text, p_limit integer);

CREATE FUNCTION circle_search_suggestions(
  p_prefix text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  category_id uuid,
  visibility circle_visibility,
  member_count integer
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH pref AS (
    SELECT NULLIF(trim(coalesce(p_prefix, '')), '') AS prefix
  )
  SELECT
    c.id,
    c.name,
    c.slug,
    c.category_id,
    c.visibility,
    c.member_count
  FROM circles c
  CROSS JOIN pref
  WHERE
    c.is_active = TRUE
    AND c.status = 'active'
    AND pref.prefix IS NOT NULL
    AND (
      lower(c.name) LIKE lower(pref.prefix) || '%'
      OR lower(c.slug) LIKE lower(pref.prefix) || '%'
    )
  ORDER BY
    c.is_featured DESC,
    c.member_count DESC,
    c.created_at DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;

COMMENT ON FUNCTION circle_search_suggestions IS
  'Prefix suggestions for active circles only. SECURITY INVOKER.';
