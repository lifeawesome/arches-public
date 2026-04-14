-- Fix infinite recursion in circle_memberships RLS
--
-- The 20251217100000_add_circle_member_roles.sql policies reference circle_memberships
-- inside circle_memberships policies (self-subquery), which can trigger:
--   42P17: infinite recursion detected in policy for relation "circle_memberships"
--
-- This migration replaces circle_memberships policies to rely on SECURITY DEFINER
-- helpers (is_circle_member, is_circle_owner, is_circle_moderator) instead of
-- subqueries against circle_memberships.

-- ============================================================================
-- Drop existing policies on circle_memberships (legacy + role-based)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own memberships" ON circle_memberships;
DROP POLICY IF EXISTS "Circle owners can view all memberships" ON circle_memberships;
DROP POLICY IF EXISTS "Users can join circles" ON circle_memberships;
DROP POLICY IF EXISTS "Users can update their own memberships" ON circle_memberships;
DROP POLICY IF EXISTS "Circle owners can update memberships" ON circle_memberships;
DROP POLICY IF EXISTS "Users can delete their own memberships" ON circle_memberships;

DROP POLICY IF EXISTS "Users can view circle memberships" ON circle_memberships;
DROP POLICY IF EXISTS "Owners and moderators can view all members" ON circle_memberships;
DROP POLICY IF EXISTS "Owners can update member roles" ON circle_memberships;
DROP POLICY IF EXISTS "Owners and moderators can remove members" ON circle_memberships;

-- ============================================================================
-- Recreate policies (non-recursive)
-- ============================================================================

-- SELECT:
-- - Owner can view all memberships
-- - Moderator can view all memberships
-- - User can view their own membership
-- - Active members can view other active members (API may further restrict via settings)
CREATE POLICY "Users can view circle memberships" ON circle_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_circle_owner(circle_id)
    OR is_circle_moderator(circle_id)
    OR (status = 'active' AND is_circle_member(circle_id))
  );

-- INSERT:
-- Users can insert their own membership row (join flow). Other enforcement happens in app/API.
CREATE POLICY "Users can join circles" ON circle_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE:
-- Only circle owners can update memberships (including role).
-- This intentionally prevents members from self-upgrading roles.
CREATE POLICY "Circle owners can update memberships" ON circle_memberships
  FOR UPDATE
  TO authenticated
  USING (is_circle_owner(circle_id))
  WITH CHECK (is_circle_owner(circle_id));

-- DELETE:
-- - Users can remove themselves
-- - Owners can remove anyone except themselves (app also enforces)
-- - Moderators can remove non-owner, non-moderator members
CREATE POLICY "Owners and moderators can remove members" ON circle_memberships
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_circle_owner(circle_id)
    OR (
      is_circle_moderator(circle_id)
      AND circle_memberships.role <> 'moderator'
      AND NOT EXISTS (
        SELECT 1 FROM circles c
        WHERE c.id = circle_memberships.circle_id
          AND c.expert_id = circle_memberships.user_id
      )
    )
  );

COMMENT ON POLICY "Users can view circle memberships" ON circle_memberships IS
  'Non-recursive membership visibility: self, owner/moderator via helper, or active members viewing active members.';

