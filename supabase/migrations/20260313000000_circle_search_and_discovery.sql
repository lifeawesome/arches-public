-- Circle Search & Discovery
-- Adds full-text search vectors + indexes for circles and circle_content,
-- plus RPC functions for search and suggestions.
--
-- Notes:
-- - We keep RLS on base tables as the source of truth.
-- - Functions are SECURITY INVOKER so RLS applies to the caller.

-- Ensure pg_trgm exists for fast prefix/ILIKE suggestions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- SEARCH VECTORS
-- ============================================================================

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(slug, '')), 'C')
  ) STORED;

ALTER TABLE circle_content
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_circles_search_vector_gin
  ON circles
  USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_circle_content_search_vector_gin
  ON circle_content
  USING GIN (search_vector);

-- Suggestions/autocomplete helpers
CREATE INDEX IF NOT EXISTS idx_circles_name_trgm
  ON circles
  USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_circles_slug_trgm
  ON circles
  USING GIN (lower(slug) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_circles_member_count
  ON circles(member_count);

-- ============================================================================
-- RPC: SEARCH
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
  score double precision
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
      coalesce(sum(cc.like_count), 0)::int AS total_like_count
    FROM circle_content cc
    WHERE cc.is_published = TRUE
    GROUP BY cc.circle_id
  )
  SELECT
    c.id,
    c.expert_id,
    c.name,
    c.slug,
    c.description,
    c.cover_image_url,
    c.visibility,
    c.category_id,
    c.is_featured,
    c.access_type,
    c.price_cents,
    c.stripe_product_id,
    c.stripe_price_id,
    c.is_active,
    c.member_count,
    c.settings,
    c.created_at,
    c.updated_at,
    coalesce(cs.post_count, 0) AS post_count,
    coalesce(cs.total_view_count, 0) AS total_view_count,
    coalesce(cs.total_like_count, 0) AS total_like_count,
    (
      -- Text relevance (circle fields)
      coalesce(ts_rank_cd(c.search_vector, q.tsq), 0) * 2.0
      -- Text relevance (content within circle)
      + coalesce(cr.content_score, 0) * 1.0
      -- Popularity (lightweight boost)
      + ln(1 + greatest(c.member_count, 0)) * 0.05
      + ln(1 + greatest(coalesce(cs.total_view_count, 0), 0)) * 0.01
      + ln(1 + greatest(coalesce(cs.total_like_count, 0), 0)) * 0.02
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
  ORDER BY
    -- When query present, primarily by score, else by featured/popularity
    CASE WHEN q.tsq IS NULL THEN 0 ELSE 1 END DESC,
    score DESC,
    c.is_featured DESC,
    c.member_count DESC,
    c.created_at DESC
  LIMIT greatest(1, least(p_limit, 50))
  OFFSET greatest(p_offset, 0);
$$;

COMMENT ON FUNCTION circle_search IS
  'Search circles by name/description/slug and optionally matching circle_content. Applies RLS as SECURITY INVOKER.';

-- ============================================================================
-- RPC: SUGGESTIONS / AUTOCOMPLETE
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
  'Fast prefix suggestions for circle names/slugs. Applies RLS as SECURITY INVOKER.';

