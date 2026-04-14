-- Circle role change audit log
-- Records who changed whose role in a circle (for owner-only role updates).

-- ============================================================================
-- TABLE: circle_role_audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES circle_memberships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_role circle_member_role NOT NULL,
  new_role circle_member_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_role_audit_log_circle_id ON circle_role_audit_log(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_role_audit_log_created_at ON circle_role_audit_log(created_at DESC);

COMMENT ON TABLE circle_role_audit_log IS 'Audit log for circle membership role changes. Only circle owners can view.';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE circle_role_audit_log ENABLE ROW LEVEL SECURITY;

-- Only circle owner can SELECT audit log for their circle
CREATE POLICY "Circle owners can view role audit log" ON circle_role_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circles
      WHERE circles.id = circle_role_audit_log.circle_id
      AND circles.expert_id = auth.uid()
    )
  );

-- Circle owner can INSERT when they change a role (API will call as that user)
CREATE POLICY "Circle owners can insert role audit log" ON circle_role_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circles
      WHERE circles.id = circle_role_audit_log.circle_id
      AND circles.expert_id = auth.uid()
    )
  );

-- No UPDATE or DELETE on audit log (append-only)
