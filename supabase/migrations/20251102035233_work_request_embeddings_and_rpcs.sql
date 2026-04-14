-- Work Request Embeddings and RPC Functions
-- This migration consolidates work request RPCs, embeddings, and vector search functionality

-- ============================================================================
-- Enable Required Extensions
-- ============================================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- Ensure vector extension is in public schema
DO $$
BEGIN
  -- If extension exists in extensions schema, move it to public
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'vector' AND n.nspname = 'extensions'
  ) THEN
    -- Drop and recreate in public schema
    DROP EXTENSION vector CASCADE;
    CREATE EXTENSION vector WITH SCHEMA public;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    -- Extension doesn't exist, create it in public
    CREATE EXTENSION vector WITH SCHEMA public;
  END IF;
  -- If already in public, do nothing
END $$;

-- Ensure http extension is in public schema
DO $$
BEGIN
  -- If extension exists in extensions schema, move it to public
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'http' AND n.nspname = 'extensions'
  ) THEN
    -- Drop and recreate in public schema
    DROP EXTENSION http CASCADE;
    CREATE EXTENSION http WITH SCHEMA public;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'http'
  ) THEN
    -- Extension doesn't exist, create it in public
    CREATE EXTENSION http WITH SCHEMA public;
  END IF;
  -- If already in public, do nothing
END $$;

-- ============================================================================
-- Work Request Embeddings
-- ============================================================================

-- Add vector embedding columns to work_requests table
-- This enables semantic search for work requests using OpenAI embeddings
ALTER TABLE work_requests
ADD COLUMN IF NOT EXISTS content_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- Create HNSW index for fast similarity search on work request content
CREATE INDEX IF NOT EXISTS idx_work_requests_content_embedding 
ON work_requests USING hnsw (content_embedding vector_cosine_ops);

-- Add comments for documentation
COMMENT ON COLUMN work_requests.content_embedding IS 'OpenAI embedding vector for semantic search of work request title and description';
COMMENT ON COLUMN work_requests.embedding_model IS 'OpenAI model used to generate the embedding';
COMMENT ON COLUMN work_requests.embedding_updated_at IS 'Timestamp when the embedding was last updated';

-- ============================================================================
-- Work Request RPC Functions
-- ============================================================================

-- Function to create work requests on behalf of users
-- This is needed when called from server-to-server contexts (e.g., Langflow)
-- where there are no user session cookies
CREATE OR REPLACE FUNCTION create_work_request_for_user(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_budget_total INTEGER DEFAULT NULL,
  p_status work_request_status DEFAULT 'processing',
  p_processing_status TEXT DEFAULT 'processing'
)
RETURNS work_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_work_request work_requests;
BEGIN
  -- Validate that the user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User % does not exist', p_user_id;
  END IF;
  
  -- Validate required fields
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;
  
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Description cannot be empty';
  END IF;
  
  -- Insert the work request
  INSERT INTO work_requests (
    user_id,
    title,
    description,
    goals,
    deadline,
    budget_total,
    status,
    processing_status
  ) VALUES (
    p_user_id,
    p_title,
    p_description,
    COALESCE(p_goals, ARRAY[]::TEXT[]),
    p_deadline,
    p_budget_total,
    p_status,
    p_processing_status
  )
  RETURNING * INTO v_work_request;
  
  RETURN v_work_request;
END;
$$;

-- Function to create work orders on behalf of users
-- Validates that the work_request exists before inserting
CREATE OR REPLACE FUNCTION create_work_order_for_request(
  p_work_request_id UUID,
  p_order_number INTEGER,
  p_title TEXT,
  p_description TEXT,
  p_deliverables TEXT[] DEFAULT NULL,
  p_estimated_hours DECIMAL(5,2) DEFAULT NULL,
  p_estimated_duration_days INTEGER DEFAULT NULL,
  p_required_skills TEXT[] DEFAULT NULL,
  p_required_expertise_area TEXT DEFAULT NULL,
  p_difficulty_level TEXT DEFAULT NULL,
  p_prerequisites INTEGER[] DEFAULT NULL,
  p_budget_allocated INTEGER DEFAULT NULL,
  p_status work_order_status DEFAULT 'pending',
  p_ai_matching_rationale TEXT DEFAULT NULL
)
RETURNS work_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_request_exists BOOLEAN;
  v_work_order work_orders;
BEGIN
  -- Validate that the work request exists
  SELECT EXISTS(SELECT 1 FROM work_requests WHERE id = p_work_request_id) INTO v_work_request_exists;
  
  IF NOT v_work_request_exists THEN
    RAISE EXCEPTION 'Work request % does not exist', p_work_request_id;
  END IF;
  
  -- Validate required fields
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;
  
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Description cannot be empty';
  END IF;
  
  IF p_order_number IS NULL OR p_order_number <= 0 THEN
    RAISE EXCEPTION 'Order number must be positive';
  END IF;
  
  -- Insert the work order
  INSERT INTO work_orders (
    work_request_id,
    order_number,
    title,
    description,
    deliverables,
    estimated_hours,
    estimated_duration_days,
    required_skills,
    required_expertise_area,
    difficulty_level,
    prerequisites,
    budget_allocated,
    status,
    ai_matching_rationale
  ) VALUES (
    p_work_request_id,
    p_order_number,
    p_title,
    p_description,
    p_deliverables,
    p_estimated_hours,
    p_estimated_duration_days,
    p_required_skills,
    p_required_expertise_area,
    p_difficulty_level,
    p_prerequisites,
    p_budget_allocated,
    p_status,
    p_ai_matching_rationale
  )
  RETURNING * INTO v_work_order;
  
  RETURN v_work_order;
END;
$$;

-- Function to update work request (for adding breakdown data, status changes)
CREATE OR REPLACE FUNCTION update_work_request_for_user(
  p_work_request_id UUID,
  p_ai_breakdown JSONB DEFAULT NULL,
  p_status work_request_status DEFAULT NULL,
  p_processing_status TEXT DEFAULT NULL,
  p_total_work_orders INTEGER DEFAULT NULL,
  p_completed_work_orders INTEGER DEFAULT NULL
)
RETURNS work_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_request_exists BOOLEAN;
  v_work_request work_requests;
  v_update_data work_requests;
BEGIN
  -- Validate that the work request exists
  SELECT EXISTS(SELECT 1 FROM work_requests WHERE id = p_work_request_id) INTO v_work_request_exists;
  
  IF NOT v_work_request_exists THEN
    RAISE EXCEPTION 'Work request % does not exist', p_work_request_id;
  END IF;
  
  -- Build update data dynamically based on provided parameters
  -- Get current values first
  SELECT * INTO v_work_request FROM work_requests WHERE id = p_work_request_id;
  
  -- Update only provided fields
  UPDATE work_requests
  SET
    ai_breakdown = COALESCE(p_ai_breakdown, ai_breakdown),
    status = COALESCE(p_status, status),
    processing_status = COALESCE(p_processing_status, processing_status),
    total_work_orders = COALESCE(p_total_work_orders, total_work_orders),
    completed_work_orders = COALESCE(p_completed_work_orders, completed_work_orders),
    updated_at = NOW()
  WHERE id = p_work_request_id
  RETURNING * INTO v_update_data;
  
  RETURN v_update_data;
END;
$$;

-- Function to update work order (for adding embeddings, status changes)
CREATE OR REPLACE FUNCTION update_work_order_embedding(
  p_work_order_id UUID,
  p_requirements_embedding vector(1536) DEFAULT NULL,
  p_embedding_model TEXT DEFAULT NULL,
  p_embedding_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS work_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order_exists BOOLEAN;
  v_work_order work_orders;
BEGIN
  -- Validate that the work order exists
  SELECT EXISTS(SELECT 1 FROM work_orders WHERE id = p_work_order_id) INTO v_work_order_exists;
  
  IF NOT v_work_order_exists THEN
    RAISE EXCEPTION 'Work order % does not exist', p_work_order_id;
  END IF;
  
  -- Update work order with embedding data
  UPDATE work_orders
  SET
    requirements_embedding = COALESCE(p_requirements_embedding, requirements_embedding),
    embedding_model = COALESCE(p_embedding_model, embedding_model),
    embedding_updated_at = COALESCE(p_embedding_updated_at, embedding_updated_at),
    updated_at = NOW()
  WHERE id = p_work_order_id
  RETURNING * INTO v_work_order;
  
  RETURN v_work_order;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION create_work_request_for_user IS 'Creates a work request on behalf of a user, bypassing RLS for server-to-server calls';
COMMENT ON FUNCTION create_work_order_for_request IS 'Creates a work order for an existing work request, bypassing RLS for server-to-server calls';
COMMENT ON FUNCTION update_work_request_for_user IS 'Updates a work request, bypassing RLS for server-to-server calls';
COMMENT ON FUNCTION update_work_order_embedding IS 'Updates a work order with embedding data, bypassing RLS for server-to-server calls';

-- ============================================================================
-- Work Request Vector Search RPC
-- ============================================================================

-- Create stored procedure for vector similarity search on work requests
-- This function enables semantic search of work requests by title/description
CREATE OR REPLACE FUNCTION search_work_requests_by_vector(
  query_embedding vector(1536),
  p_user_id uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  status text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wr.id,
    wr.user_id,
    wr.title,
    wr.description,
    wr.status::text,
    1 - (wr.content_embedding <=> query_embedding) as similarity
  FROM work_requests wr
  WHERE 
    wr.user_id = p_user_id
    AND wr.content_embedding IS NOT NULL
    AND 1 - (wr.content_embedding <=> query_embedding) > match_threshold
  ORDER BY wr.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION search_work_requests_by_vector IS 'Finds work requests with similar content embeddings using cosine similarity, filtered by user_id';

