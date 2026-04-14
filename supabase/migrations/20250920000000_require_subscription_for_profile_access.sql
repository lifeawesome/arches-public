-- Update profile access policy to require active subscription
-- Only users with active or trialing subscriptions can view other users' profiles
-- This ensures that only paying members can browse and message other members

-- Drop the old policy that allowed all authenticated users to view profiles
DROP POLICY IF EXISTS "Users can view other users' public profiles" ON profiles;

-- Drop the new policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Subscribers can view other users' public profiles" ON profiles;

-- Create new policy that requires an active subscription to view other profiles
CREATE POLICY "Subscribers can view other users' public profiles" ON profiles
  FOR SELECT USING (
    -- Users can always view their own profile
    auth.uid() = id
    OR
    -- Users can view other profiles if they have an active or trialing subscription
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.user_id = auth.uid()
      AND subscriptions.status IN ('active', 'trialing')
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Subscribers can view other users' public profiles" ON profiles IS 
  'Allows users with active subscriptions to view other members profiles for messaging and browsing. Users can always view their own profile.';

