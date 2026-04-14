-- Fix Function Security Warnings (Safe Version)
-- Address Supabase security advisor warnings for function search_path
-- and materialized view API access WITHOUT breaking existing functionality
-- https://supabase.com/docs/guides/database/database-linter

-- ============================================================================
-- Fix Function Search Path Issues
-- Add explicit search_path to prevent schema injection attacks
-- This is safe and won't break functionality
-- ============================================================================

-- 1. update_circles_updated_at
CREATE OR REPLACE FUNCTION update_circles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. update_network_connections_updated_at
CREATE OR REPLACE FUNCTION update_network_connections_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. update_circle_member_count
CREATE OR REPLACE FUNCTION update_circle_member_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circles 
    SET member_count = member_count + 1
    WHERE id = NEW.circle_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circles 
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.circle_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- If membership becomes active, increment; if inactive, decrement
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
      UPDATE circles 
      SET member_count = member_count + 1
      WHERE id = NEW.circle_id;
    ELSIF NEW.status != 'active' AND OLD.status = 'active' THEN
      UPDATE circles 
      SET member_count = GREATEST(0, member_count - 1)
      WHERE id = NEW.circle_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 4. update_event_registration_count
CREATE OR REPLACE FUNCTION update_event_registration_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circle_events 
    SET current_registrations = current_registrations + 1
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circle_events 
    SET current_registrations = GREATEST(0, current_registrations - 1)
    WHERE id = OLD.event_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 5. update_session_booking_count
CREATE OR REPLACE FUNCTION update_session_booking_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circle_sessions 
    SET current_bookings = current_bookings + 1
    WHERE id = NEW.session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circle_sessions 
    SET current_bookings = GREATEST(0, current_bookings - 1)
    WHERE id = OLD.session_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 6. update_content_comment_count
CREATE OR REPLACE FUNCTION update_content_comment_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circle_content 
    SET comment_count = comment_count + 1
    WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circle_content 
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.content_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 7. is_circle_owner
CREATE OR REPLACE FUNCTION is_circle_owner(p_circle_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM circles
    WHERE id = p_circle_id
    AND expert_id = auth.uid()
  );
END;
$$;

-- 8. is_circle_member
CREATE OR REPLACE FUNCTION is_circle_member(p_circle_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM circle_memberships
    WHERE circle_id = p_circle_id
    AND user_id = auth.uid()
    AND status = 'active'
  );
END;
$$;

-- 9. can_access_circle
CREATE OR REPLACE FUNCTION can_access_circle(p_circle_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  circle_access_type TEXT;
  is_owner BOOLEAN;
  is_member BOOLEAN;
BEGIN
  -- Get circle access type
  SELECT access_type INTO circle_access_type
  FROM circles
  WHERE id = p_circle_id;
  
  -- Check if user is owner
  is_owner := is_circle_owner(p_circle_id);
  
  -- Check if user is member
  is_member := is_circle_member(p_circle_id);
  
  -- Return access decision
  RETURN is_owner OR is_member OR circle_access_type = 'free';
END;
$$;

-- 10. refresh_circle_member_activity
CREATE OR REPLACE FUNCTION refresh_circle_member_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY circle_member_activity;
END;
$$;

-- 11. update_public_event_registrations_updated_at
CREATE OR REPLACE FUNCTION update_public_event_registrations_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 12. get_user_saved_items_count
CREATE OR REPLACE FUNCTION get_user_saved_items_count(p_user_id UUID)
RETURNS TABLE (
  total_count BIGINT,
  experts_count BIGINT,
  offers_count BIGINT,
  circles_count BIGINT,
  posts_count BIGINT,
  events_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM saved_experts WHERE user_id = p_user_id)::BIGINT +
    (SELECT COUNT(*) FROM saved_offers WHERE user_id = p_user_id)::BIGINT +
    (SELECT COUNT(*) FROM saved_circles WHERE user_id = p_user_id)::BIGINT +
    (SELECT COUNT(*) FROM saved_posts WHERE user_id = p_user_id)::BIGINT +
    (SELECT COUNT(*) FROM saved_events WHERE user_id = p_user_id)::BIGINT as total_count,
    (SELECT COUNT(*) FROM saved_experts WHERE user_id = p_user_id)::BIGINT as experts_count,
    (SELECT COUNT(*) FROM saved_offers WHERE user_id = p_user_id)::BIGINT as offers_count,
    (SELECT COUNT(*) FROM saved_circles WHERE user_id = p_user_id)::BIGINT as circles_count,
    (SELECT COUNT(*) FROM saved_posts WHERE user_id = p_user_id)::BIGINT as posts_count,
    (SELECT COUNT(*) FROM saved_events WHERE user_id = p_user_id)::BIGINT as events_count;
END;
$$;

-- ============================================================================
-- Fix Materialized View API Access
-- Revoke direct API access from materialized view, users should query through
-- appropriate endpoints that enforce business logic
-- ============================================================================

-- Revoke direct select access from anon and authenticated
REVOKE SELECT ON circle_member_activity FROM anon;
REVOKE SELECT ON circle_member_activity FROM authenticated;

-- Grant select only to service_role (for backend operations)
GRANT SELECT ON circle_member_activity TO service_role;

-- Create a helper function that allows controlled access to member activity
-- This ensures business logic is enforced when accessing the data
CREATE OR REPLACE FUNCTION get_circle_member_activity(
  p_circle_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  circle_id UUID,
  user_id UUID,
  content_count BIGINT,
  comment_count BIGINT,
  event_attendance_count BIGINT,
  last_content_at TIMESTAMP WITH TIME ZONE,
  last_comment_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if user has access to this circle
  IF NOT can_access_circle(p_circle_id) THEN
    RAISE EXCEPTION 'Access denied to circle';
  END IF;
  
  -- Return activity data
  RETURN QUERY
  SELECT 
    cma.circle_id,
    cma.user_id,
    cma.content_count,
    cma.comment_count,
    cma.event_attendance_count,
    cma.last_content_at,
    cma.last_comment_at
  FROM circle_member_activity cma
  WHERE cma.circle_id = get_circle_member_activity.p_circle_id
  AND (get_circle_member_activity.p_user_id IS NULL OR cma.user_id = get_circle_member_activity.p_user_id);
END;
$$;

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION get_circle_member_activity TO authenticated;

-- ============================================================================
-- Documentation
-- ============================================================================

-- Add comments to document the security improvements
COMMENT ON FUNCTION update_circles_updated_at IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION update_network_connections_updated_at IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION update_circle_member_count IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION update_event_registration_count IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION update_session_booking_count IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION update_content_comment_count IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION is_circle_owner IS 'Helper function with explicit search_path for security';
COMMENT ON FUNCTION is_circle_member IS 'Helper function with explicit search_path for security';
COMMENT ON FUNCTION can_access_circle IS 'Access control function with explicit search_path for security';
COMMENT ON FUNCTION refresh_circle_member_activity IS 'Refresh function with explicit search_path for security';
COMMENT ON FUNCTION update_public_event_registrations_updated_at IS 'Trigger function with explicit search_path for security';
COMMENT ON FUNCTION get_user_saved_items_count IS 'Count function with explicit search_path for security';
COMMENT ON FUNCTION get_circle_member_activity IS 'Safely retrieve circle member activity with proper access control. Use this instead of querying the materialized view directly.';

-- ============================================================================
-- NOTES ON REMAINING WARNINGS
-- ============================================================================

-- Extension in Public Schema Warnings (vector, http):
-- These extensions are intentionally in the public schema due to compatibility
-- requirements with table column types (vector(1536)). Moving them to extensions
-- schema would require recreating all vector columns and indexes, which is risky.
-- The security risk is minimal since these are well-maintained extensions.
-- Consider addressing in a future migration with proper testing.

-- Auth Leaked Password Protection:
-- This is configured in Supabase Auth settings, not in database migrations.
-- Enable in: Supabase Dashboard > Authentication > Providers > Email > 
-- "Password strength and leaked password protection"

-- Vulnerable Postgres Version:
-- This requires upgrading the database instance via Supabase Dashboard.
-- Go to: Settings > Infrastructure > Database and initiate upgrade.
-- Schedule during maintenance window as it requires brief downtime.
