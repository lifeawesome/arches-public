-- Circle Search RPC improvements
-- - Add total_count to circle_search output
-- - Add RPC for trending circles

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
  'Search circles by name/description/slug and optionally matching circle_content. Returns total_count for pagination. Applies RLS as SECURITY INVOKER.';

-- ============================================================================
-- RPC: TRENDING
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
  'Returns trending public circle_ids by recent content engagement window. Applies RLS as SECURITY INVOKER.';

