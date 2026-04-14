-- TEMPORARY ROLLBACK: Restore previous working RLS policy
-- This fixes the infinite redirect loop by restoring the policy that allows authenticated users
-- We'll fix the subscription bypass issue properly after debugging

-- Drop the new policy
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- Restore the previous policy that was working
-- This allows authenticated users to view profiles (temporary, for debugging)
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (
    -- Users can always view their own profile
    (select auth.uid()) = id
    OR
    -- Users can view other profiles if they have an active or trialing subscription
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.user_id = (select auth.uid())
      AND subscriptions.status IN ('active', 'trialing')
    )
    OR
    -- TEMPORARY: Allow all authenticated users (this is the bypass we need to fix properly)
    -- This is restored to fix the redirect loop, will be fixed in next migration
    (select auth.role()) = 'authenticated'
  );

COMMENT ON POLICY "Users can view profiles" ON profiles IS 
  'TEMPORARY: Restored previous policy to fix redirect loop. Will be properly fixed in next migration.';

