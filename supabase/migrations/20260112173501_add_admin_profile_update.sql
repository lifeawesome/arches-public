-- Add Admin UPDATE Policy for Profiles Table
-- Allow admins to update any profile (for impersonation support)

-- Drop the policy if it already exists (idempotent)
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- UPDATE: Admin users can update any profile
-- Uses is_admin() function (SECURITY DEFINER) to avoid infinite recursion
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Comments
COMMENT ON POLICY "Admins can update any profile" ON profiles IS 'Admin users can update any profile (e.g., during impersonation). Uses is_admin() function to avoid infinite recursion.';

