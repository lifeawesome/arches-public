-- Add Circle Member Roles and Invitation System
-- This migration adds role-based permissions, member invitations, and activity tracking

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create role enum for circle members (only if it doesn't exist)
DO $$ BEGIN
  CREATE TYPE circle_member_role AS ENUM ('member', 'contributor', 'moderator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE UPDATES
-- ============================================================================

-- Add new columns to circle_memberships table (only if they don't exist)
ALTER TABLE circle_memberships
  ADD COLUMN IF NOT EXISTS role circle_member_role DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Create indexes for faster role and status queries
CREATE INDEX IF NOT EXISTS idx_circle_memberships_role ON circle_memberships(circle_id, role);
CREATE INDEX IF NOT EXISTS idx_circle_memberships_status ON circle_memberships(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_memberships_invitation_token ON circle_memberships(invitation_token) WHERE invitation_token IS NOT NULL;

-- ============================================================================
-- MATERIALIZED VIEW FOR MEMBER ACTIVITY
-- ============================================================================

-- Drop existing view if it exists, then create new one
DROP MATERIALIZED VIEW IF EXISTS circle_member_activity;

-- Create materialized view for member activity stats
CREATE MATERIALIZED VIEW circle_member_activity AS
SELECT 
  cm.circle_id,
  cm.user_id,
  COUNT(DISTINCT cc.id) as content_count,
  COUNT(DISTINCT ccom.id) as comment_count,
  COUNT(DISTINCT cer.id) as event_attendance_count,
  MAX(cc.created_at) as last_content_at,
  MAX(ccom.created_at) as last_comment_at
FROM circle_memberships cm
LEFT JOIN circle_content cc ON cc.circle_id = cm.circle_id AND cc.author_id = cm.user_id
LEFT JOIN circle_comments ccom ON ccom.content_id IN (
  SELECT id FROM circle_content WHERE circle_id = cm.circle_id
) AND ccom.user_id = cm.user_id
LEFT JOIN circle_event_registrations cer ON cer.event_id IN (
  SELECT id FROM circle_events WHERE circle_id = cm.circle_id
) AND cer.user_id = cm.user_id
GROUP BY cm.circle_id, cm.user_id;

-- Create unique index for the materialized view (allows concurrent refresh)
CREATE UNIQUE INDEX idx_circle_member_activity_unique ON circle_member_activity(circle_id, user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to refresh activity stats (to be called by scheduled job or trigger)
CREATE OR REPLACE FUNCTION refresh_circle_member_activity()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY circle_member_activity;
END;
$$;

-- ============================================================================
-- RLS POLICIES FOR MEMBER MANAGEMENT
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view circle memberships" ON circle_memberships;
DROP POLICY IF EXISTS "Owners and moderators can view all members" ON circle_memberships;
DROP POLICY IF EXISTS "Owners can update member roles" ON circle_memberships;
DROP POLICY IF EXISTS "Owners and moderators can remove members" ON circle_memberships;

-- Policy: Circle owners and moderators can view all members (including pending)
CREATE POLICY "Owners and moderators can view all members" ON circle_memberships
  FOR SELECT
  TO authenticated
  USING (
    -- User is the circle owner
    EXISTS (
      SELECT 1 FROM circles
      WHERE circles.id = circle_memberships.circle_id
      AND circles.expert_id = auth.uid()
    )
    OR
    -- User is a moderator in the circle
    EXISTS (
      SELECT 1 FROM circle_memberships cm
      WHERE cm.circle_id = circle_memberships.circle_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
      AND cm.status = 'active'
    )
    OR
    -- User is viewing their own membership
    circle_memberships.user_id = auth.uid()
    OR
    -- User is an active member viewing other active members
    (
      circle_memberships.status = 'active'
      AND EXISTS (
        SELECT 1 FROM circle_memberships cm
        WHERE cm.circle_id = circle_memberships.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
      )
    )
  );

-- Policy: Only circle owners can update member roles
CREATE POLICY "Owners can update member roles" ON circle_memberships
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circles
      WHERE circles.id = circle_memberships.circle_id
      AND circles.expert_id = auth.uid()
    )
  );

-- Policy: Owners and moderators can delete/remove members
CREATE POLICY "Owners and moderators can remove members" ON circle_memberships
  FOR DELETE
  TO authenticated
  USING (
    -- User is the circle owner
    EXISTS (
      SELECT 1 FROM circles
      WHERE circles.id = circle_memberships.circle_id
      AND circles.expert_id = auth.uid()
    )
    OR
    -- User is a moderator in the circle
    EXISTS (
      SELECT 1 FROM circle_memberships cm
      WHERE cm.circle_id = circle_memberships.circle_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'moderator'
      AND cm.status = 'active'
    )
    OR
    -- User is removing themselves
    circle_memberships.user_id = auth.uid()
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TYPE circle_member_role IS 'Roles for circle members: member (view only), contributor (can post), moderator (can manage content and members)';
COMMENT ON COLUMN circle_memberships.role IS 'Member role in the circle';
COMMENT ON COLUMN circle_memberships.invited_by IS 'User who sent the invitation';
COMMENT ON COLUMN circle_memberships.invitation_token IS 'Unique token for invitation link';
COMMENT ON COLUMN circle_memberships.invitation_sent_at IS 'When the invitation was sent';
COMMENT ON COLUMN circle_memberships.notes IS 'Admin notes about this member';
COMMENT ON MATERIALIZED VIEW circle_member_activity IS 'Aggregated activity stats for circle members';

