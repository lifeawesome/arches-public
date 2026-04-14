-- Fix RLS Policy Bypass for Profiles Table
-- Remove the fallback that allows all authenticated users to view profiles
-- This ensures subscription requirements are properly enforced

-- Create a SECURITY DEFINER function to check subscription tier without triggering RLS recursion
CREATE OR REPLACE FUNCTION has_paid_subscription_tier(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = user_id
    AND profiles.subscription_tier IN ('builder', 'pro', 'partner')
  );
END;
$$;

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- Recreate the policy WITHOUT the authenticated user bypass
-- Users can only view profiles if:
-- 1. It's their own profile (checked FIRST - this MUST work for auth to function), OR
-- 2. They have an active/trialing subscription in subscriptions table, OR
-- 3. They have a paid subscription_tier (builder, pro, partner) - checked via SECURITY DEFINER function
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (
    -- CRITICAL: Users can ALWAYS view their own profile
    -- This check must work for authentication and user data loading to function
    (select auth.uid()) = id
    OR
    -- For OTHER users' profiles, require subscription
    (
      -- Users can view other profiles if they have an active or trialing subscription
      EXISTS (
        SELECT 1 FROM subscriptions
        WHERE subscriptions.user_id = (select auth.uid())
        AND subscriptions.status IN ('active', 'trialing')
      )
      OR
      -- Users can view other profiles if they have a paid subscription_tier
      -- Uses SECURITY DEFINER function to avoid infinite recursion
      has_paid_subscription_tier((select auth.uid()))
    )
  );

-- Update comments
COMMENT ON POLICY "Users can view profiles" ON profiles IS 
  'RLS policy: Users can view their own profile, or subscribers (via subscriptions table or subscription_tier) can view other profiles. Subscription requirement enforced.';
COMMENT ON FUNCTION has_paid_subscription_tier IS 
  'Security definer function to check if a user has a paid subscription tier without triggering RLS recursion.';

