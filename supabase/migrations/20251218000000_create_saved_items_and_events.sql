-- Create Saved Items and Event Registration System
-- This migration creates tables for bookmarking/saving various content types
-- and tracking event registrations

-- ============================================================================
-- SAVED ITEMS TABLES
-- ============================================================================

-- Saved Expert Offers
CREATE TABLE IF NOT EXISTS saved_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES expert_offers(id) ON DELETE CASCADE,
  notes TEXT, -- Optional user notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save an offer once
  UNIQUE(user_id, offer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_offers_user_id ON saved_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_offers_offer_id ON saved_offers(offer_id);
CREATE INDEX IF NOT EXISTS idx_saved_offers_created_at ON saved_offers(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved offers" ON saved_offers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save offers" ON saved_offers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own saved offers" ON saved_offers
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE saved_offers IS 'Stores user bookmarks for expert offers';
COMMENT ON COLUMN saved_offers.user_id IS 'The user who saved the offer';
COMMENT ON COLUMN saved_offers.offer_id IS 'The expert offer that was saved';

-- ============================================================================

-- Saved Circles
CREATE TABLE IF NOT EXISTS saved_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  notes TEXT, -- Optional user notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save a circle once
  UNIQUE(user_id, circle_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_circles_user_id ON saved_circles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_circles_circle_id ON saved_circles(circle_id);
CREATE INDEX IF NOT EXISTS idx_saved_circles_created_at ON saved_circles(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_circles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved circles" ON saved_circles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save circles" ON saved_circles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own saved circles" ON saved_circles
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE saved_circles IS 'Stores user bookmarks for circles';
COMMENT ON COLUMN saved_circles.user_id IS 'The user who saved the circle';
COMMENT ON COLUMN saved_circles.circle_id IS 'The circle that was saved';

-- ============================================================================

-- Saved Posts (Circle Content)
CREATE TABLE IF NOT EXISTS saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES circle_content(id) ON DELETE CASCADE,
  notes TEXT, -- Optional user notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save a post once
  UNIQUE(user_id, post_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_created_at ON saved_posts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved posts" ON saved_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts" ON saved_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own saved posts" ON saved_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE saved_posts IS 'Stores user bookmarks for circle posts/content';
COMMENT ON COLUMN saved_posts.user_id IS 'The user who saved the post';
COMMENT ON COLUMN saved_posts.post_id IS 'The circle content/post that was saved';

-- ============================================================================

-- Saved Events (Public Events from Sanity CMS)
CREATE TABLE IF NOT EXISTS saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, -- Sanity _id (external CMS)
  event_slug TEXT NOT NULL, -- For easier linking
  event_title TEXT, -- Cache for display
  event_start_date TIMESTAMP WITH TIME ZONE, -- Cache for sorting
  notes TEXT, -- Optional user notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only save an event once
  UNIQUE(user_id, event_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event_id ON saved_events(event_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_created_at ON saved_events(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own saved events" ON saved_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save events" ON saved_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their own saved events" ON saved_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update their saved events notes" ON saved_events
  FOR UPDATE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE saved_events IS 'Stores user bookmarks for public events from Sanity CMS';
COMMENT ON COLUMN saved_events.user_id IS 'The user who saved the event';
COMMENT ON COLUMN saved_events.event_id IS 'The Sanity event _id';
COMMENT ON COLUMN saved_events.event_slug IS 'The event slug for constructing URLs';

-- ============================================================================
-- EVENT REGISTRATION TABLES
-- ============================================================================

-- Public Event Registrations (for Sanity CMS events)
CREATE TABLE IF NOT EXISTS public_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, -- Sanity _id (external CMS)
  event_slug TEXT NOT NULL, -- For easier linking
  event_title TEXT, -- Cache for display
  event_start_date TIMESTAMP WITH TIME ZONE, -- Cache for sorting
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'attended')),
  registration_data JSONB DEFAULT '{}', -- Store any additional registration info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only register once per event
  UNIQUE(user_id, event_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_public_event_registrations_user_id ON public_event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_public_event_registrations_event_id ON public_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_public_event_registrations_status ON public_event_registrations(status);
CREATE INDEX IF NOT EXISTS idx_public_event_registrations_created_at ON public_event_registrations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public_event_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own event registrations" ON public_event_registrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can register for events" ON public_event_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own event registrations" ON public_event_registrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own event registrations" ON public_event_registrations
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public_event_registrations IS 'Tracks user registrations for public events from Sanity CMS';
COMMENT ON COLUMN public_event_registrations.user_id IS 'The user who registered';
COMMENT ON COLUMN public_event_registrations.event_id IS 'The Sanity event _id';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_public_event_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_public_event_registrations_updated_at
  BEFORE UPDATE ON public_event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_public_event_registrations_updated_at();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- User Activity Feed - Aggregates all user activities
CREATE OR REPLACE VIEW user_activity_feed AS
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

-- Add comment for documentation
COMMENT ON VIEW user_activity_feed IS 'Aggregates all user activities including saves, connections, and event registrations';

-- ============================================================================
-- SAVED ITEMS COUNT FUNCTIONS
-- ============================================================================

-- Function to get total saved items count for a user
CREATE OR REPLACE FUNCTION get_user_saved_items_count(p_user_id UUID)
RETURNS TABLE (
  total_count BIGINT,
  experts_count BIGINT,
  offers_count BIGINT,
  circles_count BIGINT,
  posts_count BIGINT,
  events_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_saved_items_count IS 'Returns counts of all saved items for a user';












