-- Fix recursion introduced by circles lifecycle RLS.
-- Root cause: circles policy queried circle_blocked_users directly, while
-- circle_blocked_users policies query circles, creating a recursive dependency.

-- Ensure helper exists and bypasses RLS safely.
CREATE OR REPLACE FUNCTION is_blocked_from_circle(p_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM circle_blocked_users
    WHERE circle_id = p_circle_id
      AND user_id = auth.uid()
  );
$$;

-- Recreate circles SELECT policy without direct subquery to circle_blocked_users.
DROP POLICY IF EXISTS "Public can view active circles" ON circles;

CREATE POLICY "Public can view active circles" ON circles
  FOR SELECT
  TO anon, authenticated
  USING (
    expert_id = auth.uid()
    OR (
      is_circle_member(id)
      AND status <> 'deleted'
      AND NOT is_blocked_from_circle(id)
    )
    OR (
      visibility = 'public'
      AND is_active = TRUE
      AND status = 'active'
    )
  );

COMMENT ON POLICY "Public can view active circles" ON circles IS
  'Public listing only for active lifecycle + public visibility; owner and active non-blocked members can view their circles.';
