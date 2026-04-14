-- Blocked users must not see circle content.
-- 1) Update can_access_circle() to deny blocked users.
-- 2) Drop stale "Users can view content in accessible circles" policy that
--    checked circle_memberships directly without a blocked-user guard.
-- 3) Update content SELECT policies so the is_free fallback also excludes
--    blocked users.

-- ============================================================================
-- 1) can_access_circle: deny blocked users before any other access logic
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

  -- Blocked users cannot access the circle
  IF EXISTS (
    SELECT 1 FROM circle_blocked_users
    WHERE circle_id = p_circle_id AND user_id = auth.uid()
  ) THEN
    RETURN FALSE;
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

COMMENT ON FUNCTION can_access_circle IS
  'Access control: owner bypass, then blocked check, then visibility/access_type. Blocked users get no access.';

-- ============================================================================
-- 2) Drop stale policy that bypasses can_access_circle
-- ============================================================================

DROP POLICY IF EXISTS "Users can view content in accessible circles" ON circle_content;

-- ============================================================================
-- 3) Recreate content SELECT policies with blocked-user exclusion
-- ============================================================================

-- Helper: returns TRUE when the current user is blocked from the given circle.
CREATE OR REPLACE FUNCTION is_blocked_from_circle(p_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM circle_blocked_users
    WHERE circle_id = p_circle_id
      AND user_id = auth.uid()
  );
$$;

-- Free approved content visible to everyone EXCEPT blocked users
DROP POLICY IF EXISTS "Anyone can view free approved content" ON circle_content;
CREATE POLICY "Anyone can view free approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND (is_deleted = FALSE OR is_deleted IS NULL)
    AND is_free = TRUE
    AND NOT is_blocked_from_circle(circle_id)
  );

-- Circle members / users with access can view approved content; blocked users excluded
DROP POLICY IF EXISTS "Circle members can view approved content" ON circle_content;
CREATE POLICY "Circle members can view approved content" ON circle_content
  FOR SELECT USING (
    approval_status = 'approved'
    AND (is_deleted = FALSE OR is_deleted IS NULL)
    AND (
      can_access_circle(circle_id)
      OR (is_free = TRUE AND NOT is_blocked_from_circle(circle_id))
    )
  );
