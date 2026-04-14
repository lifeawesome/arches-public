-- Update pathway admin policies to use new app RBAC
-- This allows the new app to use app_is_administrator() while old app policies remain untouched

DROP POLICY IF EXISTS "Admins can manage pathways" ON pathways;
DROP POLICY IF EXISTS "Admins can view all pathways" ON pathways;

-- New app uses app_is_administrator instead of is_admin
CREATE POLICY "App administrators can manage pathways" ON pathways
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "App administrators can view all pathways" ON pathways
  FOR SELECT
  TO authenticated
  USING (app_is_administrator(auth.uid()));

-- Keep old admin policy for backward compatibility with old app
-- Old app can still use is_admin() function if needed
CREATE POLICY "Legacy admins can manage pathways" ON pathways
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

COMMENT ON POLICY "App administrators can manage pathways" ON pathways IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage pathways';
COMMENT ON POLICY "Legacy admins can manage pathways" ON pathways IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage pathways for backward compatibility';

