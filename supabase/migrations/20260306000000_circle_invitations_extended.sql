-- Circle Invitations Extended
-- Adds invitation_accepted_at, invitation_expires_at, invited_email; nullable user_id for pending;
-- who_can_invite in circles.settings; circle_invitation_audit_log; RLS for invite/accept.

-- ============================================================================
-- circle_memberships: new columns and nullable user_id
-- ============================================================================

ALTER TABLE circle_memberships
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS invited_email TEXT;

-- Allow pending invitation rows without a user (invite by email before signup)
ALTER TABLE circle_memberships
  ALTER COLUMN user_id DROP NOT NULL;

-- Index for listing pending by circle
CREATE INDEX IF NOT EXISTS idx_circle_memberships_pending
  ON circle_memberships(circle_id, status) WHERE status = 'pending';

COMMENT ON COLUMN circle_memberships.invitation_accepted_at IS 'When the invitee accepted the invitation (joined the circle)';
COMMENT ON COLUMN circle_memberships.invitation_expires_at IS 'Optional expiration time for the invitation link';
COMMENT ON COLUMN circle_memberships.invited_email IS 'Email address invited (for pending rows when user_id is null)';

-- ============================================================================
-- circles.settings: who_can_invite
-- ============================================================================

-- Backfill existing circles with default who_can_invite
UPDATE circles
SET settings = COALESCE(settings, '{}'::jsonb) || '{"who_can_invite": "moderators_only"}'::jsonb
WHERE (settings->>'who_can_invite') IS NULL;

-- Default for new circles (ensure default in app when creating; DB default stays backward compatible)

-- ============================================================================
-- circle_invitation_audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_invitation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES circle_memberships(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('invitation_sent', 'invitation_accepted', 'invitation_resent', 'invitation_revoked')),
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_invitation_audit_log_circle_id ON circle_invitation_audit_log(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_invitation_audit_log_created_at ON circle_invitation_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_invitation_audit_log_membership_id ON circle_invitation_audit_log(membership_id);

COMMENT ON TABLE circle_invitation_audit_log IS 'Audit log for circle invitation events. Only circle owner (and optionally moderators) can view.';

ALTER TABLE circle_invitation_audit_log ENABLE ROW LEVEL SECURITY;

-- Circle owner and moderators can SELECT
CREATE POLICY "Circle owners and moderators can view invitation audit log" ON circle_invitation_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_invitation_audit_log.circle_id
      AND c.expert_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM circle_memberships cm
      WHERE cm.circle_id = circle_invitation_audit_log.circle_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
      AND cm.status = 'active'
    )
  );

-- Owners and moderators can INSERT when they send/resent/revoke; accept is performed by the invitee (performed_by = auth.uid())
CREATE POLICY "Circle owners and moderators can insert invitation audit log" ON circle_invitation_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM circles
        WHERE circles.id = circle_invitation_audit_log.circle_id
        AND circles.expert_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM circle_memberships cm
        WHERE cm.circle_id = circle_invitation_audit_log.circle_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'moderator'
        AND cm.status = 'active'
      )
      OR action = 'invitation_accepted'
    )
  );

-- No UPDATE or DELETE (append-only)

-- ============================================================================
-- RLS: allow owners/moderators to INSERT invitation rows (user_id NULL, pending)
-- ============================================================================

CREATE POLICY "Owners and moderators can create invitations" ON circle_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NULL
    AND status = 'pending'
    AND (is_circle_owner(circle_id) OR is_circle_moderator(circle_id))
  );

-- ============================================================================
-- RLS: allow invitee to UPDATE row to accept (set user_id, status, invitation_accepted_at)
-- ============================================================================

CREATE POLICY "Users can accept invitation" ON circle_memberships
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS NULL
    AND invitation_token IS NOT NULL
    AND (invitation_expires_at IS NULL OR invitation_expires_at > now())
  )
  WITH CHECK (user_id = auth.uid());

-- Allow owners and moderators to update pending rows (e.g. revoke: set invitation_token null, invitation_expires_at = now)
CREATE POLICY "Owners and moderators can update pending invitations" ON circle_memberships
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND (is_circle_owner(circle_id) OR is_circle_moderator(circle_id))
  )
  WITH CHECK (status = 'pending');
