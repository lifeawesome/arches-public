-- Fix Security Definer Views
-- Remove SECURITY DEFINER from views to properly enforce RLS policies
-- https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

-- ============================================================================
-- Fix experts_needing_embeddings view
-- ============================================================================

-- Drop and recreate without SECURITY DEFINER (using SECURITY INVOKER, which is the default)
DROP VIEW IF EXISTS experts_needing_embeddings CASCADE;

CREATE VIEW experts_needing_embeddings 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  expertise_area,
  resume_skills,
  resume_education,
  resume_experience,
  created_at,
  updated_at
FROM experts
WHERE 
  is_active = true 
  AND (
    expertise_area_embedding IS NULL OR
    skills_embedding IS NULL OR
    education_embedding IS NULL OR
    experience_embedding IS NULL
  )
ORDER BY created_at DESC;

COMMENT ON VIEW experts_needing_embeddings IS 'View of active experts that need multi-embeddings generated (expertise_area, skills, education, or experience). Uses SECURITY INVOKER to properly enforce RLS.';

-- ============================================================================
-- Fix user_activity_feed view
-- ============================================================================

-- Drop and recreate without SECURITY DEFINER (using SECURITY INVOKER, which is the default)
DROP VIEW IF EXISTS user_activity_feed CASCADE;

CREATE VIEW user_activity_feed 
WITH (security_invoker = true) AS
  -- Saved Experts
  SELECT 
    user_id,
    'saved' as action_type,
    'expert' as item_type,
    expert_id::text as item_id,
    created_at,
    NULL::jsonb as metadata
  FROM saved_experts
  
  UNION ALL
  
  -- Saved Offers
  SELECT 
    user_id,
    'saved' as action_type,
    'offer' as item_type,
    offer_id::text as item_id,
    created_at,
    NULL::jsonb as metadata
  FROM saved_offers
  
  UNION ALL
  
  -- Saved Circles
  SELECT 
    user_id,
    'saved' as action_type,
    'circle' as item_type,
    circle_id::text as item_id,
    created_at,
    NULL::jsonb as metadata
  FROM saved_circles
  
  UNION ALL
  
  -- Saved Posts
  SELECT 
    user_id,
    'saved' as action_type,
    'post' as item_type,
    post_id::text as item_id,
    created_at,
    NULL::jsonb as metadata
  FROM saved_posts
  
  UNION ALL
  
  -- Saved Events
  SELECT 
    user_id,
    'saved' as action_type,
    'event' as item_type,
    event_id as item_id,
    created_at,
    jsonb_build_object('slug', event_slug, 'title', event_title) as metadata
  FROM saved_events
  
  UNION ALL
  
  -- Network Connections (accepted)
  SELECT 
    user_id,
    'connection' as action_type,
    'user' as item_type,
    connected_user_id::text as item_id,
    COALESCE(accepted_at, created_at) as created_at,
    NULL::jsonb as metadata
  FROM network_connections 
  WHERE status = 'accepted'
  
  UNION ALL
  
  -- Circle Event Registrations
  SELECT 
    user_id,
    'event_registration' as action_type,
    'circle_event' as item_type,
    event_id::text as item_id,
    created_at,
    NULL::jsonb as metadata
  FROM circle_event_registrations
  WHERE status = 'registered'
  
  UNION ALL
  
  -- Public Event Registrations
  SELECT 
    user_id,
    'event_registration' as action_type,
    'public_event' as item_type,
    event_id as item_id,
    created_at,
    jsonb_build_object('slug', event_slug, 'title', event_title) as metadata
  FROM public_event_registrations
  WHERE status = 'registered'
  
  ORDER BY created_at DESC;

COMMENT ON VIEW user_activity_feed IS 'Aggregates all user activities including saves, connections, and event registrations. Uses SECURITY INVOKER to properly enforce RLS on underlying tables.';

-- ============================================================================
-- Grant appropriate permissions
-- ============================================================================

-- Grant SELECT on the views to authenticated users
GRANT SELECT ON experts_needing_embeddings TO authenticated;
GRANT SELECT ON user_activity_feed TO authenticated;

-- Grant SELECT to service_role for admin operations
GRANT SELECT ON experts_needing_embeddings TO service_role;
GRANT SELECT ON user_activity_feed TO service_role;
