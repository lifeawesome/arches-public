-- Create work_requests and work_orders tables for AI-powered task breakdown
-- This system allows users to describe what they want to accomplish,
-- AI breaks it down into smaller work orders, and matches them to qualified experts

-- Work Request Status
CREATE TYPE work_request_status AS ENUM (
  'draft',           -- User is still editing
  'processing',      -- AI is breaking down the request
  'active',          -- Work orders are being matched/worked on
  'completed',       -- All work orders completed
  'cancelled'        -- User cancelled the request
);

-- Work Order Status
CREATE TYPE work_order_status AS ENUM (
  'pending',         -- Not yet assigned
  'matching',        -- AI is finding qualified experts
  'matched',         -- Experts identified, awaiting acceptance
  'assigned',        -- Expert accepted and working on it
  'in_progress',     -- Work is in progress
  'review',          -- Work submitted for review
  'completed',       -- Work completed and approved
  'cancelled'        -- Work order cancelled
);

-- Main work requests table
CREATE TABLE IF NOT EXISTS work_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goals TEXT[], -- Array of specific goals/outcomes
  deadline TIMESTAMP WITH TIME ZONE,
  budget_total INTEGER, -- Total budget in USD cents
  budget_currency TEXT DEFAULT 'USD',
  
  -- AI processing
  ai_breakdown JSONB, -- AI's analysis and breakdown strategy
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processing_error TEXT,
  
  -- Status and metadata
  status work_request_status DEFAULT 'draft',
  total_work_orders INTEGER DEFAULT 0,
  completed_work_orders INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Search
  searchable_content TEXT,
  
  CONSTRAINT work_requests_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT work_requests_description_not_empty CHECK (length(trim(description)) > 0)
);

-- Individual work orders (broken down from work requests)
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_request_id UUID NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
  
  -- Order details
  order_number INTEGER NOT NULL, -- Sequence within the work request
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deliverables TEXT[], -- Expected outputs
  estimated_hours DECIMAL(5,2), -- Estimated time to complete
  estimated_duration_days INTEGER, -- How many days this should take
  
  -- Requirements
  required_skills TEXT[], -- Skills needed for this work order
  required_expertise_area TEXT, -- Primary expertise area
  difficulty_level TEXT, -- beginner, intermediate, advanced, expert
  prerequisites INTEGER[], -- Other work_order numbers that must complete first
  
  -- Budget
  budget_allocated INTEGER, -- Budget for this specific work order in cents
  
  -- Assignment and matching
  status work_order_status DEFAULT 'pending',
  assigned_expert_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  matched_experts JSONB, -- Array of matched experts with scores
  ai_matching_rationale TEXT, -- Why these experts were matched
  
  -- Progress
  assigned_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Deliverables
  submission_notes TEXT,
  submission_files JSONB, -- Array of file paths/URLs
  review_notes TEXT,
  review_rating INTEGER, -- 1-5 stars
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT work_orders_title_not_empty CHECK (length(trim(title)) > 0),
  CONSTRAINT work_orders_order_number_positive CHECK (order_number > 0),
  CONSTRAINT work_orders_review_rating_valid CHECK (review_rating IS NULL OR (review_rating >= 1 AND review_rating <= 5))
);

-- Work order applications (experts can apply to work on orders)
CREATE TABLE IF NOT EXISTS work_order_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Application details
  cover_letter TEXT,
  proposed_timeline_days INTEGER,
  proposed_budget INTEGER, -- Expert's proposed budget in cents
  relevant_experience TEXT,
  portfolio_links TEXT[],
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure expert can only apply once per work order
  UNIQUE(work_order_id, expert_id)
);

-- Work order messages/updates
CREATE TABLE IF NOT EXISTS work_order_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  update_type TEXT NOT NULL, -- comment, status_change, file_upload, milestone
  content TEXT,
  metadata JSONB, -- Additional data (file info, old/new status, etc)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_requests_user_id ON work_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_status ON work_requests(status);
CREATE INDEX IF NOT EXISTS idx_work_requests_created_at ON work_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_work_request_id ON work_orders(work_request_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_expert_id ON work_orders(assigned_expert_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_required_skills ON work_orders USING GIN(required_skills);

CREATE INDEX IF NOT EXISTS idx_work_order_applications_work_order_id ON work_order_applications(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_applications_expert_id ON work_order_applications(expert_id);
CREATE INDEX IF NOT EXISTS idx_work_order_applications_status ON work_order_applications(status);

CREATE INDEX IF NOT EXISTS idx_work_order_updates_work_order_id ON work_order_updates(work_order_id);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_work_requests_fulltext_search ON work_requests 
USING GIN(to_tsvector('english', 
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(searchable_content, '')
));

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_work_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Update searchable content
  NEW.searchable_content = 
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.goals, ' '), '');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_requests_updated_at
  BEFORE UPDATE ON work_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_work_requests_updated_at();

CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();

-- Function to update work request completion status
CREATE OR REPLACE FUNCTION update_work_request_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the parent work request's completion stats
  UPDATE work_requests
  SET 
    total_work_orders = (
      SELECT COUNT(*) 
      FROM work_orders 
      WHERE work_request_id = NEW.work_request_id
    ),
    completed_work_orders = (
      SELECT COUNT(*) 
      FROM work_orders 
      WHERE work_request_id = NEW.work_request_id 
      AND status = 'completed'
    )
  WHERE id = NEW.work_request_id;
  
  -- If all work orders are completed, mark request as completed
  UPDATE work_requests
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = NEW.work_request_id
  AND total_work_orders > 0
  AND total_work_orders = completed_work_orders
  AND status != 'completed';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_request_completion
  AFTER INSERT OR UPDATE OF status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_request_completion();

-- Add RLS policies
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_updates ENABLE ROW LEVEL SECURITY;

-- Work Requests Policies
-- Users can view their own work requests
CREATE POLICY "Users can view own work requests" ON work_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own work requests
CREATE POLICY "Users can create work requests" ON work_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own work requests
CREATE POLICY "Users can update own work requests" ON work_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own draft work requests
CREATE POLICY "Users can delete own draft work requests" ON work_requests
  FOR DELETE USING (auth.uid() = user_id AND status = 'draft');

-- Work Orders Policies
-- Users can view work orders for their work requests
CREATE POLICY "Users can view own work orders" ON work_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM work_requests 
      WHERE work_requests.id = work_orders.work_request_id 
      AND work_requests.user_id = auth.uid()
    )
  );

-- Experts can view work orders they're assigned to or have applied to
CREATE POLICY "Experts can view assigned work orders" ON work_orders
  FOR SELECT USING (
    assigned_expert_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM work_order_applications
      WHERE work_order_applications.work_order_id = work_orders.id
      AND work_order_applications.expert_id = auth.uid()
    )
  );

-- Experts can view pending/matching work orders to apply
CREATE POLICY "Experts can view available work orders" ON work_orders
  FOR SELECT USING (status IN ('pending', 'matching', 'matched'));

-- Work Order Applications Policies
CREATE POLICY "Experts can create applications" ON work_order_applications
  FOR INSERT WITH CHECK (auth.uid() = expert_id);

CREATE POLICY "Users can view applications for their work orders" ON work_order_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM work_orders
      JOIN work_requests ON work_requests.id = work_orders.work_request_id
      WHERE work_orders.id = work_order_applications.work_order_id
      AND work_requests.user_id = auth.uid()
    )
  );

CREATE POLICY "Experts can view their own applications" ON work_order_applications
  FOR SELECT USING (expert_id = auth.uid());

-- Work Order Updates Policies
CREATE POLICY "Users can view updates for their work" ON work_order_updates
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM work_orders
      JOIN work_requests ON work_requests.id = work_orders.work_request_id
      WHERE work_orders.id = work_order_updates.work_order_id
      AND (work_requests.user_id = auth.uid() OR work_orders.assigned_expert_id = auth.uid())
    )
  );

CREATE POLICY "Users can create updates" ON work_order_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE work_requests IS 'User-submitted work requests that AI breaks down into work orders';
COMMENT ON TABLE work_orders IS 'Individual work items broken down from work requests, matched to experts';
COMMENT ON TABLE work_order_applications IS 'Expert applications to work on specific work orders';
COMMENT ON TABLE work_order_updates IS 'Timeline of updates, comments, and status changes for work orders';
COMMENT ON COLUMN work_requests.ai_breakdown IS 'AI analysis of how to break down the work request';
COMMENT ON COLUMN work_orders.matched_experts IS 'AI-matched experts with compatibility scores';
COMMENT ON COLUMN work_orders.prerequisites IS 'Array of work_order numbers that must complete first';

