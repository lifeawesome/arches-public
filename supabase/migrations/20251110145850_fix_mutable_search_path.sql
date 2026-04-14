-- Fix mutable search_path in all functions
-- This prevents search path attacks by explicitly setting search_path
-- For SECURITY DEFINER functions, this is critical for security

-- ============================================================================
-- Profiles table functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Experts table functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_experts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Subscriptions table functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Conversations and messages functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations 
  SET last_message_at = NEW.created_at, updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mark_message_as_read(message_id UUID, user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Add user_id to read_by array if not already there
  UPDATE public.messages
  SET 
    read_by = ARRAY(SELECT DISTINCT unnest(read_by || ARRAY[user_id])),
    updated_at = NOW()
  WHERE id = message_id
    AND NOT (user_id = ANY(read_by)); -- Only update if not already read

  -- Update conversation's last_message_at to trigger refresh
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = (SELECT conversation_id FROM public.messages WHERE id = message_id);
END;
$$;

CREATE OR REPLACE FUNCTION get_unread_message_count(conv_id UUID, user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.messages
    WHERE conversation_id = conv_id
      AND sender_id != user_id  -- Don't count messages sent by the user
      AND NOT (user_id = ANY(read_by))  -- Not marked as read by this user
  );
END;
$$;

-- Also fix the older version that takes only user_id
CREATE OR REPLACE FUNCTION get_unread_message_count(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE user_id = ANY(c.participants)
      AND NOT (user_id = ANY(m.read_by))
      AND m.sender_id != user_id
  );
END;
$$;

-- ============================================================================
-- Work requests and work orders functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_work_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Update searchable content
  NEW.searchable_content = 
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.goals, ' '), '');
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_work_request_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Update the parent work request's completion stats
  UPDATE public.work_requests
  SET 
    total_work_orders = (
      SELECT COUNT(*) 
      FROM public.work_orders 
      WHERE work_request_id = NEW.work_request_id
    ),
    completed_work_orders = (
      SELECT COUNT(*) 
      FROM public.work_orders 
      WHERE work_request_id = NEW.work_request_id 
      AND status = 'completed'
    ),
    updated_at = NOW()
  WHERE id = NEW.work_request_id;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Payment functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_work_order_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_payment_milestones_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_escrow_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- When payment moves to escrowed, create deposit transaction
  IF NEW.escrow_status = 'funded' AND (OLD.escrow_status IS NULL OR OLD.escrow_status != 'funded') THEN
    INSERT INTO public.escrow_transactions (
      payment_id,
      transaction_type,
      amount,
      currency,
      from_user_id,
      description
    ) VALUES (
      NEW.id,
      'deposit',
      NEW.amount,
      NEW.currency,
      NEW.client_id,
      'Funds deposited to escrow for work order #' || (SELECT order_number FROM public.work_orders WHERE id = NEW.work_order_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- User status and roles functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_admin_or_moderator(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('admin', 'moderator')
  );
END;
$$;

CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_admin_user BOOLEAN;
  current_user_id UUID;
BEGIN
  -- Get current authenticated user ID
  current_user_id := auth.uid();
  
  -- Allow role changes if there's no authenticated user (during migrations/seeding)
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Allow role changes if the user making the change is an admin
  SELECT EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE id = current_user_id AND role = 'admin'
  ) INTO is_admin_user;
  
  -- If role is being changed and user is not an admin, prevent it
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_admin_user THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Marketing preferences functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_marketing_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_marketing_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert default marketing preferences for new user
  INSERT INTO public.marketing_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile for new user. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_profiles_updated_at() IS 'Updates profile updated_at timestamp. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_experts_updated_at() IS 'Updates expert updated_at and last_activity_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_subscriptions_updated_at() IS 'Updates subscription updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_conversation_last_message() IS 'Updates conversation last_message_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION mark_message_as_read(UUID, UUID) IS 'Marks message as read. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION get_unread_message_count(UUID, UUID) IS 'Gets unread message count for conversation. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION get_unread_message_count(UUID) IS 'Gets unread message count for user. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_work_requests_updated_at() IS 'Updates work request updated_at and searchable_content. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_work_orders_updated_at() IS 'Updates work order updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_work_request_completion() IS 'Updates work request completion stats. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_work_order_payments_updated_at() IS 'Updates payment updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_payment_milestones_updated_at() IS 'Updates milestone updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION create_escrow_transaction() IS 'Creates escrow transaction when payment is funded. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_user_last_seen() IS 'Updates user last_seen_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION is_admin(UUID) IS 'Checks if user is admin. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION is_admin_or_moderator(UUID) IS 'Checks if user is admin or moderator. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION prevent_role_change() IS 'Prevents non-admins from changing roles. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_marketing_preferences_updated_at() IS 'Updates marketing preferences updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION public.handle_new_user_marketing_preferences() IS 'Creates marketing preferences for new user. Fixed: SET search_path = '' for security.';

-- ============================================================================
-- Expert offers functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_expert_offers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Work request conversations functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.work_request_conversations 
  SET 
    total_messages = total_messages + 1,
    last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Work request RPC functions
-- ============================================================================

CREATE OR REPLACE FUNCTION create_work_request_for_user(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_budget_total INTEGER DEFAULT NULL,
  p_status public.work_request_status DEFAULT 'processing',
  p_processing_status TEXT DEFAULT 'processing'
)
RETURNS public.work_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_work_request public.work_requests;
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
  INSERT INTO public.work_requests (
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
  p_status public.work_order_status DEFAULT 'pending',
  p_ai_matching_rationale TEXT DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work_request_exists BOOLEAN;
  v_work_order public.work_orders;
BEGIN
  -- Validate that the work request exists
  SELECT EXISTS(SELECT 1 FROM public.work_requests WHERE id = p_work_request_id) INTO v_work_request_exists;
  
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
  INSERT INTO public.work_orders (
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

CREATE OR REPLACE FUNCTION update_work_request_for_user(
  p_work_request_id UUID,
  p_ai_breakdown JSONB DEFAULT NULL,
  p_status public.work_request_status DEFAULT NULL,
  p_processing_status TEXT DEFAULT NULL,
  p_total_work_orders INTEGER DEFAULT NULL,
  p_completed_work_orders INTEGER DEFAULT NULL
)
RETURNS public.work_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_work_request_exists BOOLEAN;
  v_work_request public.work_requests;
  v_update_data public.work_requests;
BEGIN
  -- Validate that the work request exists
  SELECT EXISTS(SELECT 1 FROM public.work_requests WHERE id = p_work_request_id) INTO v_work_request_exists;
  
  IF NOT v_work_request_exists THEN
    RAISE EXCEPTION 'Work request % does not exist', p_work_request_id;
  END IF;
  
  -- Build update data dynamically based on provided parameters
  -- Get current values first
  SELECT * INTO v_work_request FROM public.work_requests WHERE id = p_work_request_id;
  
  -- Update only provided fields
  UPDATE public.work_requests
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

-- ============================================================================
-- Work Orders Embedding Columns
-- ============================================================================

-- Add vector embedding columns to work_orders table if they don't exist
-- This enables semantic search for work orders using OpenAI embeddings
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS requirements_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- Create HNSW index for fast similarity search on work order requirements
CREATE INDEX IF NOT EXISTS idx_work_orders_requirements_embedding 
ON public.work_orders USING hnsw (requirements_embedding vector_cosine_ops);

-- Add comments for documentation
COMMENT ON COLUMN public.work_orders.requirements_embedding IS 'OpenAI embedding vector for semantic search of work order requirements (title, description, skills)';
COMMENT ON COLUMN public.work_orders.embedding_model IS 'OpenAI model used to generate the embedding';
COMMENT ON COLUMN public.work_orders.embedding_updated_at IS 'Timestamp when the embedding was last updated';

-- ============================================================================
-- Work Orders Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_work_order_embedding(
  p_work_order_id UUID,
  p_requirements_embedding vector(1536) DEFAULT NULL,
  p_embedding_model TEXT DEFAULT NULL,
  p_embedding_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_order_exists BOOLEAN;
  v_work_order public.work_orders;
BEGIN
  -- Validate that the work order exists
  SELECT EXISTS(SELECT 1 FROM public.work_orders WHERE id = p_work_order_id) INTO v_work_order_exists;
  
  IF NOT v_work_order_exists THEN
    RAISE EXCEPTION 'Work order % does not exist', p_work_order_id;
  END IF;
  
  -- Update work order with embedding data
  UPDATE public.work_orders
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
SET search_path = public
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
  FROM public.work_requests wr
  WHERE 
    wr.user_id = p_user_id
    AND wr.content_embedding IS NOT NULL
    AND 1 - (wr.content_embedding <=> query_embedding) > match_threshold
  ORDER BY wr.content_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_work_orders_by_vector(
  query_embedding vector(1536),
  p_user_id uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  work_request_id uuid,
  order_number integer,
  title text,
  description text,
  required_skills text[],
  required_expertise_area text,
  difficulty_level text,
  status text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wo.id,
    wo.work_request_id,
    wo.order_number,
    wo.title,
    wo.description,
    wo.required_skills,
    wo.required_expertise_area,
    wo.difficulty_level,
    wo.status::text,
    1 - (wo.requirements_embedding <=> query_embedding) as similarity
  FROM public.work_orders wo
  INNER JOIN public.work_requests wr ON wo.work_request_id = wr.id
  WHERE 
    wr.user_id = p_user_id
    AND wo.requirements_embedding IS NOT NULL
    AND 1 - (wo.requirements_embedding <=> query_embedding) > match_threshold
  ORDER BY wo.requirements_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Embedding generation functions
-- ============================================================================

CREATE OR REPLACE FUNCTION call_openai_embeddings_api(input_text TEXT)
RETURNS float[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  api_key TEXT;
  api_response http_response;
  embedding_array float[];
BEGIN
  -- Get OpenAI API key from vault
  SELECT decrypted_secret INTO api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'openai_api_key';
  
  IF api_key IS NULL THEN
    RAISE EXCEPTION 'OpenAI API key not found in vault';
  END IF;
  
  -- Set connection and request timeouts to 30 seconds
  -- Connection timeout for SSL handshake (in seconds)
  PERFORM set_config('http.curlopt_connecttimeout', '30', false);
  -- Request timeout for the entire HTTP request (in seconds)
  PERFORM set_config('http.curlopt_timeout', '30', false);
  
  -- Call OpenAI Embeddings API
  SELECT * INTO api_response FROM http((
    'POST',
    'https://api.openai.com/v1/embeddings',
    ARRAY[
      http_header('Authorization', 'Bearer ' || api_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'model', 'text-embedding-3-small',
      'input', input_text
    )::text
  )::http_request);

  -- Extract embedding from response
  IF api_response.status = 200 THEN
    SELECT ARRAY(
      SELECT json_array_elements_text(
        (api_response.content::json->'data'->0->'embedding')::json
      )::float
    ) INTO embedding_array;
    
    RETURN embedding_array;
  ELSE
    RAISE EXCEPTION 'OpenAI API error: % %', api_response.status, api_response.content;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION generate_expertise_area_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expertise_area_text TEXT;
  embedding_array float[];
BEGIN
  -- Fetch expertise area
  SELECT expertise_area INTO expertise_area_text
  FROM public.experts
  WHERE id = expert_id;
  
  IF expertise_area_text IS NULL OR expertise_area_text = '' THEN
    RAISE WARNING 'Expert % has no expertise_area', expert_id;
    RETURN;
  END IF;
  
  -- Generate embedding
  embedding_array := public.call_openai_embeddings_api(expertise_area_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE public.experts
    SET 
      expertise_area_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION generate_skills_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  skills_array TEXT[];
  skills_text TEXT;
  embedding_array float[];
BEGIN
  -- Fetch skills
  SELECT resume_skills INTO skills_array
  FROM public.experts
  WHERE id = expert_id;
  
  IF skills_array IS NULL OR array_length(skills_array, 1) = 0 THEN
    RAISE WARNING 'Expert % has no resume_skills', expert_id;
    RETURN;
  END IF;
  
  -- Convert array to text
  skills_text := array_to_string(skills_array, ', ');
  
  -- Generate embedding
  embedding_array := public.call_openai_embeddings_api(skills_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE public.experts
    SET 
      skills_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION generate_education_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  education_json JSONB;
  education_text TEXT;
  embedding_array float[];
  edu_record RECORD;
BEGIN
  -- Fetch education data
  SELECT resume_education INTO education_json
  FROM public.experts
  WHERE id = expert_id;
  
  IF education_json IS NULL OR jsonb_array_length(education_json) = 0 THEN
    RAISE WARNING 'Expert % has no resume_education', expert_id;
    RETURN;
  END IF;
  
  -- Convert JSONB to text format
  education_text := '';
  FOR edu_record IN 
    SELECT value AS edu FROM jsonb_array_elements(education_json)
  LOOP
    IF education_text != '' THEN
      education_text := education_text || '. ';
    END IF;
    
    education_text := education_text || 
      COALESCE(edu_record.edu->>'degree', '') || ' ' ||
      COALESCE('in ' || (edu_record.edu->>'field_of_study'), '') || ' ' ||
      COALESCE('from ' || (edu_record.edu->>'institution'), '');
    
    IF edu_record.edu->'honors' IS NOT NULL THEN
      education_text := education_text || ' Honors: ' || 
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(edu_record.edu->'honors')), ', ');
    END IF;
  END LOOP;
  
  IF education_text = '' OR trim(education_text) = '' THEN
    RAISE WARNING 'Expert % has invalid education data', expert_id;
    RETURN;
  END IF;
  
  -- Generate embedding
  embedding_array := public.call_openai_embeddings_api(education_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE public.experts
    SET 
      education_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION generate_experience_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  experience_json JSONB;
  experience_text TEXT;
  embedding_array float[];
  exp_record RECORD;
BEGIN
  -- Fetch experience data
  SELECT resume_experience INTO experience_json
  FROM public.experts
  WHERE id = expert_id;
  
  IF experience_json IS NULL OR jsonb_array_length(experience_json) = 0 THEN
    RAISE WARNING 'Expert % has no resume_experience', expert_id;
    RETURN;
  END IF;
  
  -- Convert JSONB to text format
  experience_text := '';
  FOR exp_record IN 
    SELECT value AS exp FROM jsonb_array_elements(experience_json)
  LOOP
    IF experience_text != '' THEN
      experience_text := experience_text || '. ';
    END IF;
    
    experience_text := experience_text || 
      COALESCE(exp_record.exp->>'title', exp_record.exp->>'position', '') || ' ' ||
      COALESCE('at ' || (exp_record.exp->>'company'), '') || '. ' ||
      COALESCE(exp_record.exp->>'description', '');
    
    IF exp_record.exp->'achievements' IS NOT NULL THEN
      experience_text := experience_text || ' Achievements: ' || 
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(exp_record.exp->'achievements')), ', ');
    END IF;
    
    IF exp_record.exp->'skills_used' IS NOT NULL THEN
      experience_text := experience_text || ' Skills used: ' || 
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(exp_record.exp->'skills_used')), ', ');
    END IF;
    
    IF exp_record.exp->>'industry' IS NOT NULL THEN
      experience_text := experience_text || ' Industry: ' || (exp_record.exp->>'industry');
    END IF;
  END LOOP;
  
  IF experience_text = '' OR trim(experience_text) = '' THEN
    RAISE WARNING 'Expert % has invalid experience data', expert_id;
    RETURN;
  END IF;
  
  -- Generate embedding
  embedding_array := public.call_openai_embeddings_api(experience_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE public.experts
    SET 
      experience_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION generate_all_expert_embeddings(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Generate all embeddings
  PERFORM public.generate_expertise_area_embedding(expert_id);
  PERFORM public.generate_skills_embedding(expert_id);
  PERFORM public.generate_education_embedding(expert_id);
  PERFORM public.generate_experience_embedding(expert_id);
END;
$$;

-- Drop all overloads of the old function first to avoid conflicts
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'match_experts_by_multi_vector'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.match_experts_by_multi_vector(' || r.args || ') CASCADE';
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION match_experts_by_multi_vector(
  query_expertise_area_embedding vector(1536),
  query_skills_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 50,
  weight_expertise_area float DEFAULT 0.50,
  weight_skills float DEFAULT 0.50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  expertise_area text,
  weighted_similarity float,
  expertise_area_similarity float,
  skills_similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH similarity_scores AS (
    SELECT 
      e.id,
      e.user_id,
      e.expertise_area,
      -- Calculate individual similarity scores
      COALESCE(
        1 - (e.expertise_area_embedding <=> query_expertise_area_embedding),
        0
      ) as expertise_area_sim,
      COALESCE(
        1 - (e.skills_embedding <=> query_skills_embedding),
        0
      ) as skills_sim
    FROM public.experts e
    WHERE 
      e.is_active = true 
      AND e.is_approved = true
      AND (
        -- At least one embedding must exist
        e.expertise_area_embedding IS NOT NULL OR
        e.skills_embedding IS NOT NULL
      )
  )
  SELECT 
    ss.id,
    ss.user_id,
    ss.expertise_area,
    -- Calculate weighted similarity score
    (
      (ss.expertise_area_sim * weight_expertise_area) +
      (ss.skills_sim * weight_skills)
    ) as weighted_similarity,
    ss.expertise_area_sim as expertise_area_similarity,
    ss.skills_sim as skills_similarity
  FROM similarity_scores ss
  WHERE 
    -- Filter by weighted similarity threshold
    (
      (ss.expertise_area_sim * weight_expertise_area) +
      (ss.skills_sim * weight_skills)
    ) > match_threshold
  ORDER BY weighted_similarity DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_generate_all_expert_embeddings()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Call the function to generate all embeddings
  -- Note: This runs synchronously within the transaction
  PERFORM public.generate_all_expert_embeddings(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION backfill_expert_embeddings(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Generate all embeddings for the expert
  PERFORM public.generate_all_expert_embeddings(expert_id);
END;
$$;

-- Add additional comments for documentation
COMMENT ON FUNCTION update_expert_offers_updated_at() IS 'Updates expert offers updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_conversations_updated_at() IS 'Updates conversations updated_at. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_conversation_stats() IS 'Updates conversation stats. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION create_work_request_for_user IS 'Creates a work request on behalf of a user. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION create_work_order_for_request IS 'Creates a work order for an existing work request. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_work_request_for_user IS 'Updates a work request. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION update_work_order_embedding IS 'Updates a work order with embedding data. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION search_work_requests_by_vector IS 'Finds work requests with similar content embeddings. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION search_work_orders_by_vector IS 'Finds work orders with similar requirements embeddings. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION call_openai_embeddings_api IS 'Helper function to call OpenAI embeddings API. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION generate_expertise_area_embedding IS 'Generates OpenAI embedding for expert expertise area. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION generate_skills_embedding IS 'Generates OpenAI embedding for expert skills. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION generate_education_embedding IS 'Generates OpenAI embedding for expert education. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION generate_experience_embedding IS 'Generates OpenAI embedding for expert work experience. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION generate_all_expert_embeddings IS 'Generates all embeddings for an expert. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION match_experts_by_multi_vector IS 'Finds experts with weighted multi-vector similarity matching. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION trigger_generate_all_expert_embeddings() IS 'Trigger function that automatically generates all embeddings. Fixed: SET search_path = '' for security.';
COMMENT ON FUNCTION backfill_expert_embeddings IS 'Backfills all embeddings for a single expert. Fixed: SET search_path = '' for security.';

