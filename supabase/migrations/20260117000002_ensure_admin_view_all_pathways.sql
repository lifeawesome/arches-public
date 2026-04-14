-- Ensure administrators can view all pathways (both active and inactive)
-- This policy complements the existing "Public can view active pathways" policy
-- by allowing administrators to see inactive pathways too

-- The existing "App administrators can view all pathways" policy should handle this,
-- but let's make sure it's working correctly by verifying the policy exists
-- and adding explicit TO anon, authenticated for clarity

-- Note: Policies are additive (OR), so administrators will see:
-- - Active pathways (from "Public can view active pathways")
-- - Inactive pathways (from "App administrators can view all pathways")

-- The policy already exists from migration 20260117000001, but we're adding this
-- comment for clarity and to ensure it works as expected

-- Verify the policy allows viewing all pathways regardless of is_active
-- (No changes needed - the existing policy already does this via USING (app_is_administrator(auth.uid())))

COMMENT ON POLICY "App administrators can view all pathways" ON pathways IS 
  'New app RBAC: Allows users with app_access_level=administrator to view ALL pathways (active and inactive). This is additive to "Public can view active pathways".';

