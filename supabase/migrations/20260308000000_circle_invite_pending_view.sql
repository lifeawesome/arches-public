-- Allow pending invitees to view private circles they were invited to by email.
-- This is used by the /api/circles/join/accept validation endpoint after sign-in.

CREATE POLICY "Pending invitees can view circles" ON circles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM circle_memberships cm
      JOIN profiles p ON p.id = auth.uid()
      WHERE cm.circle_id = circles.id
        AND cm.status = 'pending'
        AND cm.user_id IS NULL
        AND cm.invited_email = p.email
    )
  );

COMMENT ON POLICY "Pending invitees can view circles" ON circles IS
  'Allows authenticated users with a pending email invitation to view private circles for the join/accept flow.';

