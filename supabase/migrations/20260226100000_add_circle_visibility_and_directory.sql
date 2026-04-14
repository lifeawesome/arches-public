-- Circle Directory and Visibility
-- Adds: circle_categories (admin-manageable), visibility, category_id, is_featured to circles;
-- RLS updates; can_access_circle considers visibility; content/events policies consider visibility.

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE circle_visibility AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- CIRCLE CATEGORIES TABLE (admin-manageable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT circle_categories_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT circle_categories_slug_not_empty CHECK (length(trim(slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_circle_categories_slug ON circle_categories(slug);
CREATE INDEX IF NOT EXISTS idx_circle_categories_is_active ON circle_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_circle_categories_sort_order ON circle_categories(sort_order);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_circle_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_circle_categories_updated_at ON circle_categories;
CREATE TRIGGER trigger_update_circle_categories_updated_at
  BEFORE UPDATE ON circle_categories
  FOR EACH ROW EXECUTE FUNCTION update_circle_categories_updated_at();

-- ============================================================================
-- RLS FOR circle_categories
-- ============================================================================

ALTER TABLE circle_categories ENABLE ROW LEVEL SECURITY;

-- Everyone (anon + authenticated) can read active categories for directory and forms
CREATE POLICY "Anyone can view active circle categories" ON circle_categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Only app administrators can insert/update/delete (app_is_administrator from 20260117000000)
CREATE POLICY "App administrators can manage circle categories" ON circle_categories
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

-- Admins need to see all categories (including inactive) in admin UI
CREATE POLICY "App administrators can view all circle categories" ON circle_categories
  FOR SELECT
  TO authenticated
  USING (app_is_administrator(auth.uid()));

-- ============================================================================
-- SEED DEFAULT CATEGORIES
-- ============================================================================

INSERT INTO circle_categories (name, slug, sort_order, is_active)
VALUES
  ('Languages', 'languages', 1, TRUE),
  ('Web', 'web', 2, TRUE),
  ('Mobile', 'mobile', 3, TRUE),
  ('DevOps & Cloud', 'devops-cloud', 4, TRUE),
  ('AI', 'ai', 5, TRUE),
  ('Games', 'games', 6, TRUE),
  ('DevTools', 'devtools', 7, TRUE),
  ('Career', 'career', 8, TRUE),
  ('Open Source', 'open-source', 9, TRUE),
  ('DevRel', 'devrel', 10, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ADD COLUMNS TO circles
-- ============================================================================

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS visibility circle_visibility NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES circle_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Constraint: public circles must have a category
ALTER TABLE circles
  DROP CONSTRAINT IF EXISTS circles_public_requires_category;
ALTER TABLE circles
  ADD CONSTRAINT circles_public_requires_category
  CHECK (visibility != 'public' OR category_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_circles_visibility ON circles(visibility);
CREATE INDEX IF NOT EXISTS idx_circles_category_id ON circles(category_id);
CREATE INDEX IF NOT EXISTS idx_circles_is_featured ON circles(is_featured);
CREATE INDEX IF NOT EXISTS idx_circles_visibility_active_featured ON circles(visibility, is_active, is_featured) WHERE visibility = 'public' AND is_active = TRUE;

COMMENT ON COLUMN circles.visibility IS 'public: listed in directory; private: only owner and members can see';
COMMENT ON COLUMN circles.category_id IS 'Required when visibility is public; references circle_categories';
COMMENT ON COLUMN circles.is_featured IS 'Curated featured circles in directory (admin-set); only for public circles';

-- ============================================================================
-- UPDATE CIRCLES RLS
-- ============================================================================

DROP POLICY IF EXISTS "Public can view active circles" ON circles;

CREATE POLICY "Public can view active circles" ON circles
  FOR SELECT
  TO anon, authenticated
  USING (
    (visibility = 'public' AND is_active = TRUE)
    OR expert_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM circle_memberships cm
      WHERE cm.circle_id = circles.id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

COMMENT ON POLICY "Public can view active circles" ON circles IS
  'Public circles visible to all; private circles only to owner and active members';

-- ============================================================================
-- UPDATE can_access_circle (consider visibility first)
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

  -- Owner always has access
  IF v_circle.expert_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Private circles: only owner or active member
  IF v_circle.visibility = 'private' THEN
    RETURN is_circle_member(p_circle_id);
  END IF;

  -- Public circles: then check access_type
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

-- ============================================================================
-- UPDATE CIRCLE CONTENT POLICY (require circle visibility for "free circle" branch)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view content in accessible circles" ON circle_content;

CREATE POLICY "Users can view content in accessible circles" ON circle_content
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = TRUE AND (
      -- Content is in a public free circle
      EXISTS (
        SELECT 1 FROM circles c
        WHERE c.id = circle_content.circle_id
          AND c.visibility = 'public'
          AND c.access_type = 'free'
          AND c.is_active = TRUE
      )
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM circles c
        WHERE c.id = circle_content.circle_id AND c.expert_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM circle_memberships cm
        WHERE cm.circle_id = circle_content.circle_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
      OR circle_content.is_free = TRUE
    )
  );

-- ============================================================================
-- UPDATE CIRCLE EVENTS POLICY (require circle visibility for "free circle" branch)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view events in accessible circles" ON circle_events;

CREATE POLICY "Users can view events in accessible circles" ON circle_events
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_events.circle_id
        AND c.visibility = 'public'
        AND c.access_type = 'free'
        AND c.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_events.circle_id AND c.expert_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM circle_memberships cm
      WHERE cm.circle_id = circle_events.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
    OR circle_events.is_free = TRUE
  );

COMMENT ON TABLE circle_categories IS 'Admin-manageable categories for public circles (directory and forms)';
