-- Circle blocked users: owner-only blocking per circle
-- Only circle owner can SELECT/INSERT/DELETE (moderators cannot block)

CREATE TABLE IF NOT EXISTS circle_blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_blocked_users_circle_id ON circle_blocked_users(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_blocked_users_user_id ON circle_blocked_users(user_id);

COMMENT ON TABLE circle_blocked_users IS 'Users blocked from a circle; only circle owner can block/unblock.';

-- ============================================================================
-- RLS: only circle owner can manage blocked list
-- ============================================================================

ALTER TABLE circle_blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle owners can view blocked users" ON circle_blocked_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circles
      WHERE id = circle_blocked_users.circle_id
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Circle owners can block users" ON circle_blocked_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    blocked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circles
      WHERE id = circle_blocked_users.circle_id
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Circle owners can unblock users" ON circle_blocked_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circles
      WHERE id = circle_blocked_users.circle_id
        AND expert_id = auth.uid()
    )
  );
