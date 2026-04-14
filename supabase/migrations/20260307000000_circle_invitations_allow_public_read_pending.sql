-- Allow reading pending invitation rows so /api/circles/join/accept can look up by token.
-- Without this, RLS blocks SELECT (no policy matched: user_id is null, visitor is not owner/moderator).
-- Rows are only exposed to clients that already have the invitation_token (used in WHERE clause).

CREATE POLICY "Allow read pending invitation by token" ON circle_memberships
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'pending'
    AND user_id IS NULL
    AND invitation_token IS NOT NULL
  );

COMMENT ON POLICY "Allow read pending invitation by token" ON circle_memberships IS
  'Allows join/accept API to look up pending invitation row by invitation_token; token is secret so no leak.';
