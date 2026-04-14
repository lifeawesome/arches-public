-- Add Admin INSERT Policy for Experts Table
-- Allow admins to insert expert profiles (for impersonation support)

-- Drop the policy if it already exists (idempotent)
DROP POLICY IF EXISTS "Admins can insert expert profiles" ON experts;

-- INSERT: Admin users can insert expert profiles for any user
CREATE POLICY "Admins can insert expert profiles" ON experts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Comments
COMMENT ON POLICY "Admins can insert expert profiles" ON experts IS 'Admin users can insert expert profiles for any user (e.g., during impersonation)';

