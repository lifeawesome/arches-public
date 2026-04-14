-- Create Community Circles System
-- This migration creates all tables, indexes, RLS policies, and triggers for the Community Circle feature

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE circle_access_type AS ENUM ('free', 'subscription', 'paid');
CREATE TYPE circle_membership_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
CREATE TYPE circle_content_type AS ENUM ('post', 'article', 'resource', 'announcement');
CREATE TYPE circle_event_type AS ENUM ('online', 'in_person', 'hybrid');
CREATE TYPE circle_session_type AS ENUM ('office_hours', 'coaching', 'group_session');
CREATE TYPE circle_registration_status AS ENUM ('registered', 'attended', 'cancelled', 'waitlist');
CREATE TYPE circle_booking_status AS ENUM ('confirmed', 'completed', 'cancelled', 'no_show');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Circles: Core circle entities
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  
  -- Access control
  access_type circle_access_type NOT NULL DEFAULT 'free',
  price_cents INTEGER, -- Price in cents for paid circles
  stripe_product_id TEXT, -- Stripe product ID for paid circles
  stripe_price_id TEXT, -- Stripe price ID for paid circles
  
  -- Status and metrics
  is_active BOOLEAN DEFAULT TRUE,
  member_count INTEGER DEFAULT 0,
  
  -- Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{
    "allow_member_posts": false,
    "auto_approve_members": true,
    "show_member_list": true,
    "require_introduction": false
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT circles_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT circles_slug_not_empty CHECK (length(trim(slug)) > 0),
  CONSTRAINT circles_price_valid CHECK (access_type != 'paid' OR (price_cents IS NOT NULL AND price_cents > 0))
);

-- Circle Memberships: Who belongs to which circles
CREATE TABLE IF NOT EXISTS circle_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Membership details
  membership_type TEXT NOT NULL DEFAULT 'free', -- 'free' or 'paid'
  status circle_membership_status NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT, -- For paid memberships
  
  -- Timestamps
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(circle_id, user_id)
);

-- Circle Content: Posts, articles, resources within circles
CREATE TABLE IF NOT EXISTS circle_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content details
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Rich text/markdown
  content_type circle_content_type NOT NULL DEFAULT 'post',
  
  -- Access control
  is_free BOOLEAN DEFAULT FALSE, -- Visible to non-members?
  is_published BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,
  
  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  
  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT circle_content_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT circle_content_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Circle Comments: Comments on content
CREATE TABLE IF NOT EXISTS circle_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES circle_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Comment details
  comment_text TEXT NOT NULL,
  parent_comment_id UUID REFERENCES circle_comments(id) ON DELETE CASCADE, -- For nested replies
  
  -- Engagement
  like_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT circle_comments_text_not_empty CHECK (length(trim(comment_text)) > 0)
);

-- Circle Events: Events scheduled within circles
CREATE TABLE IF NOT EXISTS circle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  
  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Location
  event_type circle_event_type NOT NULL DEFAULT 'online',
  location_details JSONB DEFAULT '{}', -- venue, address, meeting_link, etc.
  
  -- Capacity
  capacity INTEGER,
  current_registrations INTEGER DEFAULT 0,
  waitlist_enabled BOOLEAN DEFAULT FALSE,
  
  -- Pricing
  is_free BOOLEAN DEFAULT TRUE,
  price_cents INTEGER,
  
  -- Additional info
  registration_url TEXT,
  cover_image_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT circle_events_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT circle_events_time_valid CHECK (end_time > start_time),
  CONSTRAINT circle_events_capacity_valid CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT circle_events_price_valid CHECK (is_free = TRUE OR (price_cents IS NOT NULL AND price_cents > 0))
);

-- Circle Event Registrations: Track who registered for events
CREATE TABLE IF NOT EXISTS circle_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES circle_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Registration details
  status circle_registration_status NOT NULL DEFAULT 'registered',
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  stripe_payment_intent_id TEXT,
  
  -- Additional info
  notes TEXT,
  
  -- Timestamps
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(event_id, user_id)
);

-- Circle Sessions: Office hours and 1:1 coaching sessions
CREATE TABLE IF NOT EXISTS circle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session details
  title TEXT NOT NULL,
  description TEXT,
  session_type circle_session_type NOT NULL DEFAULT 'office_hours',
  
  -- Schedule
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Capacity
  max_participants INTEGER NOT NULL DEFAULT 1,
  current_bookings INTEGER DEFAULT 0,
  
  -- Pricing
  price_cents INTEGER DEFAULT 0,
  
  -- Meeting details
  meeting_link TEXT,
  meeting_password TEXT,
  
  -- Status
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT circle_sessions_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT circle_sessions_duration_valid CHECK (duration_minutes > 0),
  CONSTRAINT circle_sessions_max_participants_valid CHECK (max_participants > 0)
);

-- Circle Session Bookings: Who booked which sessions
CREATE TABLE IF NOT EXISTS circle_session_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES circle_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Booking details
  status circle_booking_status NOT NULL DEFAULT 'confirmed',
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  stripe_payment_intent_id TEXT,
  
  -- Additional info
  notes TEXT,
  
  -- Timestamps
  booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(session_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Circles indexes
CREATE INDEX IF NOT EXISTS idx_circles_expert_id ON circles(expert_id);
CREATE INDEX IF NOT EXISTS idx_circles_slug ON circles(slug);
CREATE INDEX IF NOT EXISTS idx_circles_access_type ON circles(access_type);
CREATE INDEX IF NOT EXISTS idx_circles_is_active ON circles(is_active);
CREATE INDEX IF NOT EXISTS idx_circles_created_at ON circles(created_at DESC);

-- Circle memberships indexes
CREATE INDEX IF NOT EXISTS idx_circle_memberships_user_id ON circle_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_memberships_circle_id ON circle_memberships(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_memberships_status ON circle_memberships(status);
CREATE INDEX IF NOT EXISTS idx_circle_memberships_stripe_subscription_id ON circle_memberships(stripe_subscription_id);

-- Circle content indexes
CREATE INDEX IF NOT EXISTS idx_circle_content_circle_id ON circle_content(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_content_author_id ON circle_content(author_id);
CREATE INDEX IF NOT EXISTS idx_circle_content_is_published ON circle_content(is_published);
CREATE INDEX IF NOT EXISTS idx_circle_content_content_type ON circle_content(content_type);
CREATE INDEX IF NOT EXISTS idx_circle_content_created_at ON circle_content(created_at DESC);

-- Circle comments indexes
CREATE INDEX IF NOT EXISTS idx_circle_comments_content_id ON circle_comments(content_id);
CREATE INDEX IF NOT EXISTS idx_circle_comments_user_id ON circle_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_comments_parent_comment_id ON circle_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_circle_comments_created_at ON circle_comments(created_at DESC);

-- Circle events indexes
CREATE INDEX IF NOT EXISTS idx_circle_events_circle_id ON circle_events(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_events_start_time ON circle_events(start_time);
CREATE INDEX IF NOT EXISTS idx_circle_events_event_type ON circle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_circle_events_created_at ON circle_events(created_at DESC);

-- Circle event registrations indexes
CREATE INDEX IF NOT EXISTS idx_circle_event_registrations_event_id ON circle_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_circle_event_registrations_user_id ON circle_event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_event_registrations_status ON circle_event_registrations(status);

-- Circle sessions indexes
CREATE INDEX IF NOT EXISTS idx_circle_sessions_circle_id ON circle_sessions(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_sessions_host_id ON circle_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_circle_sessions_start_time ON circle_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_circle_sessions_status ON circle_sessions(status);

-- Circle session bookings indexes
CREATE INDEX IF NOT EXISTS idx_circle_session_bookings_session_id ON circle_session_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_circle_session_bookings_user_id ON circle_session_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_session_bookings_status ON circle_session_bookings(status);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_circles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER trigger_update_circles_updated_at
  BEFORE UPDATE ON circles
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_memberships_updated_at
  BEFORE UPDATE ON circle_memberships
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_content_updated_at
  BEFORE UPDATE ON circle_content
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_comments_updated_at
  BEFORE UPDATE ON circle_comments
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_events_updated_at
  BEFORE UPDATE ON circle_events
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_event_registrations_updated_at
  BEFORE UPDATE ON circle_event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_sessions_updated_at
  BEFORE UPDATE ON circle_sessions
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

CREATE TRIGGER trigger_update_circle_session_bookings_updated_at
  BEFORE UPDATE ON circle_session_bookings
  FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();

-- Auto-update member_count in circles when memberships change
CREATE OR REPLACE FUNCTION update_circle_member_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_circle_member_count
  AFTER INSERT OR UPDATE OR DELETE ON circle_memberships
  FOR EACH ROW EXECUTE FUNCTION update_circle_member_count();

-- Auto-update current_registrations in circle_events
CREATE OR REPLACE FUNCTION update_event_registration_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_registration_count
  AFTER INSERT OR DELETE ON circle_event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_event_registration_count();

-- Auto-update current_bookings in circle_sessions
CREATE OR REPLACE FUNCTION update_session_booking_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_booking_count
  AFTER INSERT OR DELETE ON circle_session_bookings
  FOR EACH ROW EXECUTE FUNCTION update_session_booking_count();

-- Auto-update comment_count in circle_content
CREATE OR REPLACE FUNCTION update_content_comment_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_content_comment_count
  AFTER INSERT OR DELETE ON circle_comments
  FOR EACH ROW EXECUTE FUNCTION update_content_comment_count();

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Check if user is circle owner
CREATE OR REPLACE FUNCTION is_circle_owner(p_circle_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM circles 
    WHERE id = p_circle_id AND expert_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is circle member
CREATE OR REPLACE FUNCTION is_circle_member(p_circle_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM circle_memberships 
    WHERE circle_id = p_circle_id 
      AND user_id = auth.uid() 
      AND status = 'active'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user can access circle (considers access type)
CREATE OR REPLACE FUNCTION can_access_circle(p_circle_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_circle RECORD;
  v_has_subscription BOOLEAN;
BEGIN
  -- Get circle details
  SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Circle owner always has access
  IF v_circle.expert_id = auth.uid() THEN
    RETURN TRUE;
  END IF;
  
  -- Free circles: anyone can access
  IF v_circle.access_type = 'free' THEN
    RETURN TRUE;
  END IF;
  
  -- Subscription-gated: check platform subscription
  IF v_circle.access_type = 'subscription' THEN
    SELECT EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE user_id = auth.uid() 
        AND status IN ('active', 'trialing')
    ) INTO v_has_subscription;
    RETURN v_has_subscription;
  END IF;
  
  -- Paid circles: check circle membership
  IF v_circle.access_type = 'paid' THEN
    RETURN is_circle_member(p_circle_id);
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_session_bookings ENABLE ROW LEVEL SECURITY;

-- Circles policies
CREATE POLICY "Public can view active circles" ON circles
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Experts can create circles" ON circles
  FOR INSERT WITH CHECK (
    auth.uid() = expert_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_expert = TRUE
    )
  );

CREATE POLICY "Circle owners can update their circles" ON circles
  FOR UPDATE USING (expert_id = auth.uid());

CREATE POLICY "Circle owners can delete their circles" ON circles
  FOR DELETE USING (expert_id = auth.uid());

-- Circle memberships policies
CREATE POLICY "Users can view their own memberships" ON circle_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Circle owners can view all memberships" ON circle_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_memberships.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Users can join circles" ON circle_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own memberships" ON circle_memberships
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Circle owners can update memberships" ON circle_memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_memberships.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own memberships" ON circle_memberships
  FOR DELETE USING (user_id = auth.uid());

-- Circle content policies
CREATE POLICY "Anyone can view free published content" ON circle_content
  FOR SELECT USING (is_published = TRUE AND is_free = TRUE);

CREATE POLICY "Circle members can view all published content" ON circle_content
  FOR SELECT USING (
    is_published = TRUE AND (
      can_access_circle(circle_id) OR
      is_free = TRUE
    )
  );

CREATE POLICY "Circle owners can create content" ON circle_content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_content.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Circle members can create content if allowed" ON circle_content
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    is_circle_member(circle_id) AND
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_content.circle_id 
        AND (settings->>'allow_member_posts')::boolean = TRUE
    )
  );

CREATE POLICY "Authors can update their own content" ON circle_content
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Circle owners can update any content in their circles" ON circle_content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_content.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Authors can delete their own content" ON circle_content
  FOR DELETE USING (author_id = auth.uid());

CREATE POLICY "Circle owners can delete any content in their circles" ON circle_content
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_content.circle_id 
        AND expert_id = auth.uid()
    )
  );

-- Circle comments policies
CREATE POLICY "Circle members can view comments on accessible content" ON circle_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_content 
      WHERE id = circle_comments.content_id 
        AND (can_access_circle(circle_id) OR is_free = TRUE)
    )
  );

CREATE POLICY "Circle members can create comments" ON circle_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM circle_content 
      WHERE id = circle_comments.content_id 
        AND can_access_circle(circle_id)
    )
  );

CREATE POLICY "Users can update their own comments" ON circle_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON circle_comments
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Circle owners can delete any comments in their circles" ON circle_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM circle_content cc
      JOIN circles c ON c.id = cc.circle_id
      WHERE cc.id = circle_comments.content_id 
        AND c.expert_id = auth.uid()
    )
  );

-- Circle events policies
CREATE POLICY "Circle members can view events" ON circle_events
  FOR SELECT USING (can_access_circle(circle_id));

CREATE POLICY "Circle owners can create events" ON circle_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_events.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Circle owners can update events" ON circle_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_events.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Circle owners can delete events" ON circle_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_events.circle_id 
        AND expert_id = auth.uid()
    )
  );

-- Circle event registrations policies
CREATE POLICY "Users can view their own registrations" ON circle_event_registrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Circle owners can view all registrations for their events" ON circle_event_registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_events ce
      JOIN circles c ON c.id = ce.circle_id
      WHERE ce.id = circle_event_registrations.event_id 
        AND c.expert_id = auth.uid()
    )
  );

CREATE POLICY "Circle members can register for events" ON circle_event_registrations
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM circle_events 
      WHERE id = circle_event_registrations.event_id 
        AND can_access_circle(circle_id)
    )
  );

CREATE POLICY "Users can update their own registrations" ON circle_event_registrations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own registrations" ON circle_event_registrations
  FOR DELETE USING (user_id = auth.uid());

-- Circle sessions policies
CREATE POLICY "Circle members can view sessions" ON circle_sessions
  FOR SELECT USING (can_access_circle(circle_id));

CREATE POLICY "Circle owners can create sessions" ON circle_sessions
  FOR INSERT WITH CHECK (
    host_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM circles 
      WHERE id = circle_sessions.circle_id 
        AND expert_id = auth.uid()
    )
  );

CREATE POLICY "Session hosts can update their sessions" ON circle_sessions
  FOR UPDATE USING (host_id = auth.uid());

CREATE POLICY "Session hosts can delete their sessions" ON circle_sessions
  FOR DELETE USING (host_id = auth.uid());

-- Circle session bookings policies
CREATE POLICY "Users can view their own bookings" ON circle_session_bookings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Session hosts can view all bookings for their sessions" ON circle_session_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_sessions 
      WHERE id = circle_session_bookings.session_id 
        AND host_id = auth.uid()
    )
  );

CREATE POLICY "Circle members can book sessions" ON circle_session_bookings
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM circle_sessions cs
      WHERE cs.id = circle_session_bookings.session_id 
        AND can_access_circle(cs.circle_id)
    )
  );

CREATE POLICY "Users can update their own bookings" ON circle_session_bookings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own bookings" ON circle_session_bookings
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE circles IS 'Core circle entities - topic-based communities created by experts';
COMMENT ON TABLE circle_memberships IS 'Tracks which users belong to which circles';
COMMENT ON TABLE circle_content IS 'Posts, articles, and resources within circles';
COMMENT ON TABLE circle_comments IS 'Comments on circle content';
COMMENT ON TABLE circle_events IS 'Events scheduled within circles';
COMMENT ON TABLE circle_event_registrations IS 'Tracks event registrations';
COMMENT ON TABLE circle_sessions IS 'Office hours and coaching sessions';
COMMENT ON TABLE circle_session_bookings IS 'Tracks session bookings';

COMMENT ON COLUMN circles.access_type IS 'free: anyone can join, subscription: requires platform subscription, paid: requires circle-specific payment';
COMMENT ON COLUMN circles.settings IS 'JSONB settings for circle configuration';
COMMENT ON COLUMN circle_content.is_free IS 'If true, content is visible to non-members as a preview';
COMMENT ON COLUMN circle_events.location_details IS 'JSONB with venue, address, meeting_link, etc.';

