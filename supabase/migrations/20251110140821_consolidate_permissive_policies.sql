-- Consolidate multiple permissive SELECT policies into single policies
-- This improves performance by reducing policy evaluation overhead
-- This migration consolidates all policy consolidation changes into a single file

-- ============================================================================
-- profiles table - Combine 3 SELECT policies into 1
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Subscribers can view other users' public profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view other users' public profiles" ON profiles;

-- Combined SELECT policy for profiles
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
    -- Authenticated users can view other profiles (if subscription check is not required)
    (select auth.role()) = 'authenticated'
  );

COMMENT ON POLICY "Users can view profiles" ON profiles IS 
  'Combined RLS policy: Users can view their own profile, subscribers can view other profiles, or authenticated users can view profiles. Uses optimized subqueries.';

-- ============================================================================
-- experts table - Combine multiple permissive SELECT policies into 1
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view active experts" ON experts;
DROP POLICY IF EXISTS "Users can manage own expert profile" ON experts;

-- Create combined SELECT policy: users can view active experts OR their own profile
CREATE POLICY "Users can view experts" ON experts
  FOR SELECT USING (
    -- Anyone can view active experts
    is_active = true
    OR
    -- Users can view their own expert profile (even if inactive)
    (select auth.uid()) = user_id
  );

-- Create separate policies for INSERT, UPDATE, DELETE (not SELECT)
CREATE POLICY "Users can insert own expert profile" ON experts
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own expert profile" ON experts
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own expert profile" ON experts
  FOR DELETE USING ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can view experts" ON experts IS 
  'Combined RLS policy: Anyone can view active experts, or users can view their own expert profile. Uses optimized subqueries.';
COMMENT ON POLICY "Users can insert own expert profile" ON experts IS 
  'RLS policy: Users can insert their own expert profile. Uses optimized subqueries.';
COMMENT ON POLICY "Users can update own expert profile" ON experts IS 
  'RLS policy: Users can update their own expert profile. Uses optimized subqueries.';
COMMENT ON POLICY "Users can delete own expert profile" ON experts IS 
  'RLS policy: Users can delete their own expert profile. Uses optimized subqueries.';

-- ============================================================================
-- work_orders table - Combine 3 SELECT policies into 1
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own work orders" ON work_orders;
DROP POLICY IF EXISTS "Experts can view assigned work orders" ON work_orders;
DROP POLICY IF EXISTS "Experts can view available work orders" ON work_orders;

-- Combined SELECT policy for work_orders
-- NOTE: Removed work_order_applications check to avoid infinite recursion
-- Experts who applied can still access via work_order_applications table directly
CREATE POLICY "Users can view work orders" ON work_orders
  FOR SELECT USING (
    -- Users can view work orders for their work requests
    work_request_id IN (
      SELECT id FROM work_requests 
      WHERE user_id = (select auth.uid())
    )
    OR
    -- Experts can view work orders they're assigned to
    assigned_expert_id = (select auth.uid())
    OR
    -- Anyone can view pending/matching work orders (for discovery)
    status IN ('pending', 'matching', 'matched')
  );

COMMENT ON POLICY "Users can view work orders" ON work_orders IS 
  'Combined RLS policy: Users can view their own work orders, experts can view assigned work orders, or anyone can view available work orders. Fixed to avoid infinite recursion by removing work_order_applications check.';

-- ============================================================================
-- work_order_applications table - Combine 2 SELECT policies into 1
-- ============================================================================
DROP POLICY IF EXISTS "Users can view applications for their work orders" ON work_order_applications;
DROP POLICY IF EXISTS "Experts can view their own applications" ON work_order_applications;

-- Helper function to check work order application access without triggering RLS recursion
CREATE OR REPLACE FUNCTION check_work_order_application_access(app_work_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  request_user_id UUID;
BEGIN
  -- Get the work request user_id directly from work_orders without triggering RLS
  SELECT wr.user_id INTO request_user_id
  FROM work_orders wo
  INNER JOIN work_requests wr ON wr.id = wo.work_request_id
  WHERE wo.id = app_work_order_id;
  
  -- Check if the current user is the work request owner
  RETURN request_user_id = (select auth.uid());
END;
$$;

-- Combined SELECT policy for work_order_applications
-- Uses security definer function to avoid infinite recursion
CREATE POLICY "Users can view work order applications" ON work_order_applications
  FOR SELECT USING (
    -- Experts can view their own applications (simple check, no recursion)
    expert_id = (select auth.uid())
    OR
    -- Users can view applications for their work orders (uses security definer function)
    check_work_order_application_access(work_order_id)
  );

COMMENT ON POLICY "Users can view work order applications" ON work_order_applications IS 
  'Combined RLS policy: Users can view applications for their work orders, or experts can view their own applications. Uses security definer function to avoid infinite recursion.';

COMMENT ON FUNCTION check_work_order_application_access IS 
  'Security definer function to check if a user can access a work order application without triggering RLS recursion.';

-- ============================================================================
-- work_order_payments table - Combine 2 SELECT policies into 1
-- ============================================================================
DROP POLICY IF EXISTS "Clients can view own payments" ON work_order_payments;
DROP POLICY IF EXISTS "Experts can view their payments" ON work_order_payments;

-- Combined SELECT policy for work_order_payments
CREATE POLICY "Users can view work order payments" ON work_order_payments
  FOR SELECT USING (
    -- Clients can view their own payments
    client_id = (select auth.uid())
    OR
    -- Experts can view payments for their work orders
    expert_id = (select auth.uid())
  );

COMMENT ON POLICY "Users can view work order payments" ON work_order_payments IS 
  'Combined RLS policy: Clients can view their own payments, or experts can view their payments. Uses optimized subqueries.';

-- ============================================================================
-- expert_offers table - Combine 2 SELECT policies into 1
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view active offers" ON expert_offers;
DROP POLICY IF EXISTS "Experts can view own offers" ON expert_offers;

-- Combined SELECT policy for expert_offers
CREATE POLICY "Users can view expert offers" ON expert_offers
  FOR SELECT USING (
    -- Anyone can view active offers
    is_active = true
    OR
    -- Experts can view all their own offers (active and inactive)
    expert_id IN (
      SELECT id FROM experts WHERE user_id = (select auth.uid())
    )
  );

COMMENT ON POLICY "Users can view expert offers" ON expert_offers IS 
  'Combined RLS policy: Anyone can view active offers, or experts can view all their own offers. Uses optimized subqueries.';

-- ============================================================================
-- user_notification_preferences table - Combine multiple permissive policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON user_notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON user_notification_preferences;

-- Create single SELECT policy
CREATE POLICY "Users can view their own notification preferences" ON user_notification_preferences
  FOR SELECT USING ((select auth.uid()) = user_id);

-- Create separate UPDATE policy (FOR ALL was covering SELECT, UPDATE, INSERT, DELETE)
CREATE POLICY "Users can update their own notification preferences" ON user_notification_preferences
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- Add INSERT policy if needed (users should be able to create their own preferences)
CREATE POLICY "Users can insert their own notification preferences" ON user_notification_preferences
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

COMMENT ON POLICY "Users can view their own notification preferences" ON user_notification_preferences IS 
  'RLS policy: Users can view their own notification preferences. Uses optimized subqueries.';
COMMENT ON POLICY "Users can update their own notification preferences" ON user_notification_preferences IS 
  'RLS policy: Users can update their own notification preferences. Uses optimized subqueries.';
COMMENT ON POLICY "Users can insert their own notification preferences" ON user_notification_preferences IS 
  'RLS policy: Users can insert their own notification preferences. Uses optimized subqueries.';

