-- Add Admin Access to Experts Table
-- Allow admins to view all experts (including pending) and approve them

-- SELECT: Admin users can view all experts for approval purposes
CREATE POLICY "Admins can view all experts" ON experts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Admin users can update any expert (for approvals)
CREATE POLICY "Admins can update any expert" ON experts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Comments
COMMENT ON POLICY "Admins can view all experts" ON experts IS 'Admin users can view all experts including pending approvals';
COMMENT ON POLICY "Admins can update any expert" ON experts IS 'Admin users can approve and update any expert profile';

