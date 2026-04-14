-- Fix infinite recursion in circles RLS policy
-- The "Public can view active circles" policy used EXISTS (SELECT FROM circle_memberships),
-- and circle_memberships policies use EXISTS (SELECT FROM circles), causing recursion.
-- Use is_circle_member(circles.id) instead; it is SECURITY DEFINER and bypasses RLS.

DROP POLICY IF EXISTS "Public can view active circles" ON circles;

CREATE POLICY "Public can view active circles" ON circles
  FOR SELECT
  TO anon, authenticated
  USING (
    (visibility = 'public' AND is_active = TRUE)
    OR expert_id = auth.uid()
    OR is_circle_member(id)
  );

COMMENT ON POLICY "Public can view active circles" ON circles IS
  'Public circles visible to all; private circles only to owner and active members. Uses is_circle_member() to avoid RLS recursion with circle_memberships.';
