-- Fix Circles Public Access
-- Allow both authenticated and anonymous users to view active circles
-- This fixes the issue where circles aren't visible on the frontend

-- ============================================================================
-- Fix Circles Table Policies
-- ============================================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can view active circles" ON circles;

-- Recreate with explicit role grants for both anon and authenticated users
CREATE POLICY "Public can view active circles" ON circles
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- ============================================================================
-- Ensure profiles table allows public viewing for circle experts
-- ============================================================================

-- Check if profiles table has proper RLS for public viewing
-- This is needed to show expert info on circle cards

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create policy to allow viewing public profile data
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- Fix Circle Content Visibility
-- ============================================================================

-- Allow viewing published circle content based on circle access
DROP POLICY IF EXISTS "Users can view content in accessible circles" ON circle_content;

CREATE POLICY "Users can view content in accessible circles" ON circle_content
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = TRUE AND (
      -- Content is in a free circle
      EXISTS (
        SELECT 1 FROM circles c
        WHERE c.id = circle_content.circle_id
        AND c.access_type = 'free'
        AND c.is_active = TRUE
      )
      OR
      -- User is the content author
      author_id = auth.uid()
      OR
      -- User is the circle owner
      EXISTS (
        SELECT 1 FROM circles c
        WHERE c.id = circle_content.circle_id
        AND c.expert_id = auth.uid()
      )
      OR
      -- User is an active member
      EXISTS (
        SELECT 1 FROM circle_memberships cm
        WHERE cm.circle_id = circle_content.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
      )
      OR
      -- Content is marked as free
      circle_content.is_free = TRUE
    )
  );

-- ============================================================================
-- Fix Circle Events Visibility
-- ============================================================================

-- Allow viewing events in accessible circles
DROP POLICY IF EXISTS "Users can view events in accessible circles" ON circle_events;

CREATE POLICY "Users can view events in accessible circles" ON circle_events
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Event is in a free circle
    EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_events.circle_id
      AND c.access_type = 'free'
      AND c.is_active = TRUE
    )
    OR
    -- User is the circle owner
    EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_events.circle_id
      AND c.expert_id = auth.uid()
    )
    OR
    -- User is an active member
    EXISTS (
      SELECT 1 FROM circle_memberships cm
      WHERE cm.circle_id = circle_events.circle_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
    OR
    -- Event is free to view
    circle_events.is_free = TRUE
  );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "Public can view active circles" ON circles IS 
  'Allows both anonymous and authenticated users to view active circles in the directory';

COMMENT ON POLICY "Public profiles are viewable by everyone" ON profiles IS 
  'Allows viewing profile information needed for circle expert display';

COMMENT ON POLICY "Users can view content in accessible circles" ON circle_content IS 
  'Controls access to circle content based on circle access type and membership';

COMMENT ON POLICY "Users can view events in accessible circles" ON circle_events IS 
  'Controls access to circle events based on circle access type and membership';
