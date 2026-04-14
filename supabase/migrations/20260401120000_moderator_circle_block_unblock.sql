-- Issue #153: Circle moderators can view block list, block eligible users, and unblock.
-- Owners retain full block (including moderators); moderators cannot block the owner or active moderators.
-- Moderators may UPDATE memberships to cancelled when blocking (owner-only UPDATE otherwise).

-- ============================================================================
-- circle_blocked_users: replace owner-only RLS
-- ============================================================================

DROP POLICY IF EXISTS "Circle owners can view blocked users" ON circle_blocked_users;
DROP POLICY IF EXISTS "Circle owners can block users" ON circle_blocked_users;
DROP POLICY IF EXISTS "Circle owners can unblock users" ON circle_blocked_users;

CREATE POLICY "Circle owners and moderators can view blocked users" ON circle_blocked_users
  FOR SELECT
  TO authenticated
  USING (
    is_circle_owner(circle_id) OR is_circle_moderator(circle_id)
  );

-- INSERT: owners may block anyone except the circle owner (expert); moderators may not block owner or active moderators.
CREATE POLICY "Circle owners and moderators can block users" ON circle_blocked_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    blocked_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_blocked_users.circle_id
        AND c.expert_id = circle_blocked_users.user_id
    )
    AND (
      is_circle_owner(circle_id)
      OR (
        is_circle_moderator(circle_id)
        AND NOT EXISTS (
          SELECT 1 FROM circle_memberships cm
          WHERE cm.circle_id = circle_blocked_users.circle_id
            AND cm.user_id = circle_blocked_users.user_id
            AND cm.status = 'active'
            AND cm.role = 'moderator'
        )
      )
    )
  );

CREATE POLICY "Circle owners and moderators can unblock users" ON circle_blocked_users
  FOR DELETE
  TO authenticated
  USING (
    is_circle_owner(circle_id) OR is_circle_moderator(circle_id)
  );

COMMENT ON TABLE circle_blocked_users IS 'Users blocked from a circle; owners and moderators can manage the block list.';

-- ============================================================================
-- circle_memberships: moderators may set status to cancelled (block flow)
-- ============================================================================

CREATE POLICY "Moderators can cancel membership for blocking" ON circle_memberships
  FOR UPDATE
  TO authenticated
  USING (
    is_circle_moderator(circle_id)
    AND status = 'active'
    AND role <> 'moderator'
    AND NOT EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_memberships.circle_id
        AND c.expert_id = circle_memberships.user_id
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND role <> 'moderator'
    AND NOT EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_memberships.circle_id
        AND c.expert_id = circle_memberships.user_id
    )
  );

COMMENT ON POLICY "Moderators can cancel membership for blocking" ON circle_memberships IS
  'Allows moderators to set active non-moderator, non-owner memberships to cancelled (e.g. circle block flow).';
