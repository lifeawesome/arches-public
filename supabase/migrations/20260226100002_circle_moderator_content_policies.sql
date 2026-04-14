-- Circle moderator content policies
-- Allow moderators (and owners) to UPDATE/DELETE any content and comments in their circle.
-- Uses SECURITY DEFINER helper is_circle_moderator() to avoid RLS recursion.

-- ============================================================================
-- HELPER: is_circle_moderator
-- ============================================================================

CREATE OR REPLACE FUNCTION is_circle_moderator(p_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM circles
    WHERE id = p_circle_id
    AND expert_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM circle_memberships
    WHERE circle_id = p_circle_id
    AND user_id = auth.uid()
    AND role = 'moderator'
    AND status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION is_circle_moderator(UUID) IS 'True if current user is circle owner or has active moderator membership in the circle. Used by RLS.';

-- ============================================================================
-- circle_content: moderator UPDATE/DELETE
-- ============================================================================

CREATE POLICY "Moderators can update content in their circle" ON circle_content
  FOR UPDATE
  TO authenticated
  USING (is_circle_moderator(circle_id));

CREATE POLICY "Moderators can delete content in their circle" ON circle_content
  FOR DELETE
  TO authenticated
  USING (is_circle_moderator(circle_id));

-- ============================================================================
-- circle_comments: moderator UPDATE/DELETE
-- ============================================================================

CREATE POLICY "Moderators can update comments in their circle" ON circle_comments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_comments.content_id
      AND is_circle_moderator(cc.circle_id)
    )
  );

CREATE POLICY "Moderators can delete comments in their circle" ON circle_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      WHERE cc.id = circle_comments.content_id
      AND is_circle_moderator(cc.circle_id)
    )
  );
