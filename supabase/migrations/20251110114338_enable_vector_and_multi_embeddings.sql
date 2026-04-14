-- Enable vector and multi-embedding system for AI-powered expert matching
-- This migration consolidates pgvector setup with the multi-embedding system
-- Final state: Multi-embedding system with expertise_area, skills, education, and experience embeddings

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

-- Add comments for extensions
COMMENT ON SCHEMA extensions IS 'Dedicated schema for PostgreSQL extensions (reserved for future use)';
COMMENT ON EXTENSION vector IS 'Enables vector similarity search for AI-powered expert matching';
COMMENT ON EXTENSION http IS 'Enables HTTP requests to external APIs (OpenAI)';

-- ============================================================================
-- Multi-Embedding Columns
-- ============================================================================

-- Drop views that depend on old profile_embedding
DROP VIEW IF EXISTS experts_needing_embeddings;

-- Add new embedding columns to experts table
ALTER TABLE experts 
ADD COLUMN IF NOT EXISTS expertise_area_embedding vector(1536),
ADD COLUMN IF NOT EXISTS skills_embedding vector(1536),
ADD COLUMN IF NOT EXISTS education_embedding vector(1536),
ADD COLUMN IF NOT EXISTS experience_embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP WITH TIME ZONE;

-- Remove old profile_embedding column if it exists
ALTER TABLE experts 
DROP COLUMN IF EXISTS profile_embedding;

-- Recreate the view with new multi-embedding columns
CREATE OR REPLACE VIEW experts_needing_embeddings AS
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

COMMENT ON VIEW experts_needing_embeddings IS 'View of active experts that need multi-embeddings generated (expertise_area, skills, education, or experience)';

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_experts_profile_embedding;

-- Create HNSW indexes for fast similarity search on each embedding type
CREATE INDEX IF NOT EXISTS idx_experts_expertise_area_embedding 
ON experts USING hnsw (expertise_area_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_experts_skills_embedding 
ON experts USING hnsw (skills_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_experts_education_embedding 
ON experts USING hnsw (education_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_experts_experience_embedding 
ON experts USING hnsw (experience_embedding vector_cosine_ops);

-- Add comments for documentation
COMMENT ON COLUMN experts.expertise_area_embedding IS 'OpenAI embedding vector for semantic matching of expertise area';
COMMENT ON COLUMN experts.skills_embedding IS 'OpenAI embedding vector for semantic matching of technical skills';
COMMENT ON COLUMN experts.education_embedding IS 'OpenAI embedding vector for semantic matching of educational background';
COMMENT ON COLUMN experts.experience_embedding IS 'OpenAI embedding vector for semantic matching of work experience';
COMMENT ON COLUMN experts.embedding_model IS 'OpenAI model used to generate the embeddings';
COMMENT ON COLUMN experts.embedding_updated_at IS 'Timestamp when the embeddings were last updated';

-- ============================================================================
-- Embedding Generation Functions
-- ============================================================================

-- Helper function to call OpenAI API and return embedding array
CREATE OR REPLACE FUNCTION call_openai_embeddings_api(input_text TEXT)
RETURNS float[]
LANGUAGE plpgsql
SECURITY DEFINER
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
    RAISE WARNING 'OpenAI API error: % %', api_response.status, api_response.content;
    RETURN NULL;
  END IF;
END;
$$;

-- Function to generate expertise area embedding
CREATE OR REPLACE FUNCTION generate_expertise_area_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expertise_area_text TEXT;
  embedding_array float[];
BEGIN
  -- Fetch expertise area
  SELECT expertise_area INTO expertise_area_text
  FROM experts
  WHERE id = expert_id;
  
  IF expertise_area_text IS NULL OR expertise_area_text = '' THEN
    RAISE WARNING 'Expert % has no expertise_area', expert_id;
    RETURN;
  END IF;
  
  -- Generate embedding
  embedding_array := call_openai_embeddings_api(expertise_area_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE experts
    SET 
      expertise_area_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

-- Function to generate skills embedding
CREATE OR REPLACE FUNCTION generate_skills_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  skills_array TEXT[];
  skills_text TEXT;
  embedding_array float[];
BEGIN
  -- Fetch skills
  SELECT resume_skills INTO skills_array
  FROM experts
  WHERE id = expert_id;
  
  IF skills_array IS NULL OR array_length(skills_array, 1) = 0 THEN
    RAISE WARNING 'Expert % has no resume_skills', expert_id;
    RETURN;
  END IF;
  
  -- Convert array to text
  skills_text := array_to_string(skills_array, ', ');
  
  -- Generate embedding
  embedding_array := call_openai_embeddings_api(skills_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE experts
    SET 
      skills_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

-- Function to generate education embedding
CREATE OR REPLACE FUNCTION generate_education_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  education_json JSONB;
  education_text TEXT;
  embedding_array float[];
  edu_record RECORD;
BEGIN
  -- Fetch education data
  SELECT resume_education INTO education_json
  FROM experts
  WHERE id = expert_id;
  
  IF education_json IS NULL OR jsonb_array_length(education_json) = 0 THEN
    RAISE WARNING 'Expert % has no resume_education', expert_id;
    RETURN;
  END IF;
  
  -- Convert JSONB to text format
  education_text := '';
  FOR edu_record IN 
    SELECT * FROM jsonb_array_elements(education_json) AS edu
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
  embedding_array := call_openai_embeddings_api(education_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE experts
    SET 
      education_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

-- Function to generate experience embedding
CREATE OR REPLACE FUNCTION generate_experience_embedding(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  experience_json JSONB;
  experience_text TEXT;
  embedding_array float[];
  exp_record RECORD;
BEGIN
  -- Fetch experience data
  SELECT resume_experience INTO experience_json
  FROM experts
  WHERE id = expert_id;
  
  IF experience_json IS NULL OR jsonb_array_length(experience_json) = 0 THEN
    RAISE WARNING 'Expert % has no resume_experience', expert_id;
    RETURN;
  END IF;
  
  -- Convert JSONB to text format
  experience_text := '';
  FOR exp_record IN 
    SELECT * FROM jsonb_array_elements(experience_json) AS exp
  LOOP
    IF experience_text != '' THEN
      experience_text := experience_text || '. ';
    END IF;
    
    experience_text := experience_text || 
      COALESCE(exp_record.exp->>'position', '') || ' ' ||
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
  embedding_array := call_openai_embeddings_api(experience_text);
  
  IF embedding_array IS NOT NULL THEN
    -- Update expert record
    UPDATE experts
    SET 
      experience_embedding = embedding_array::vector,
      embedding_model = 'text-embedding-3-small',
      embedding_updated_at = NOW()
    WHERE id = expert_id;
  END IF;
END;
$$;

-- Function to generate all embeddings for an expert
CREATE OR REPLACE FUNCTION generate_all_expert_embeddings(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Generate all embeddings
  PERFORM generate_expertise_area_embedding(expert_id);
  PERFORM generate_skills_embedding(expert_id);
  PERFORM generate_education_embedding(expert_id);
  PERFORM generate_experience_embedding(expert_id);
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION call_openai_embeddings_api IS 'Helper function to call OpenAI embeddings API';
COMMENT ON FUNCTION generate_expertise_area_embedding IS 'Generates OpenAI embedding for expert expertise area';
COMMENT ON FUNCTION generate_skills_embedding IS 'Generates OpenAI embedding for expert skills';
COMMENT ON FUNCTION generate_education_embedding IS 'Generates OpenAI embedding for expert education';
COMMENT ON FUNCTION generate_experience_embedding IS 'Generates OpenAI embedding for expert work experience';
COMMENT ON FUNCTION generate_all_expert_embeddings IS 'Generates all embeddings (expertise_area, skills, education, experience) for an expert';

-- ============================================================================
-- Multi-Vector Search RPC
-- ============================================================================

-- Create stored procedure for multi-vector similarity search
-- This function enables weighted semantic matching of experts to work orders using multiple embeddings
CREATE OR REPLACE FUNCTION match_experts_by_multi_vector(
  query_expertise_area_embedding vector(1536),
  query_skills_embedding vector(1536),
  query_requirements_embedding vector(1536), -- Used for experience and education matching
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 50,
  weight_expertise_area float DEFAULT 0.30,
  weight_skills float DEFAULT 0.30,
  weight_experience float DEFAULT 0.25,
  weight_education float DEFAULT 0.15
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  expertise_area text,
  weighted_similarity float,
  expertise_area_similarity float,
  skills_similarity float,
  experience_similarity float,
  education_similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.user_id,
    e.expertise_area,
    -- Calculate weighted similarity score
    (
      COALESCE(
        (1 - (e.expertise_area_embedding <=> query_expertise_area_embedding)) * weight_expertise_area,
        0
      ) +
      COALESCE(
        (1 - (e.skills_embedding <=> query_skills_embedding)) * weight_skills,
        0
      ) +
      COALESCE(
        (1 - (e.experience_embedding <=> query_requirements_embedding)) * weight_experience,
        0
      ) +
      COALESCE(
        (1 - (e.education_embedding <=> query_requirements_embedding)) * weight_education,
        0
      )
    ) as weighted_similarity,
    -- Individual similarity scores
    COALESCE(
      1 - (e.expertise_area_embedding <=> query_expertise_area_embedding),
      0
    ) as expertise_area_similarity,
    COALESCE(
      1 - (e.skills_embedding <=> query_skills_embedding),
      0
    ) as skills_similarity,
    COALESCE(
      1 - (e.experience_embedding <=> query_requirements_embedding),
      0
    ) as experience_similarity,
    COALESCE(
      1 - (e.education_embedding <=> query_requirements_embedding),
      0
    ) as education_similarity
  FROM experts e
  WHERE 
    e.is_active = true 
    AND e.is_approved = true
    AND (
      -- At least one embedding must exist
      e.expertise_area_embedding IS NOT NULL OR
      e.skills_embedding IS NOT NULL OR
      e.experience_embedding IS NOT NULL OR
      e.education_embedding IS NOT NULL
    )
    AND (
      -- Calculate weighted similarity and filter by threshold
      (
        COALESCE(
          (1 - (e.expertise_area_embedding <=> query_expertise_area_embedding)) * weight_expertise_area,
          0
        ) +
        COALESCE(
          (1 - (e.skills_embedding <=> query_skills_embedding)) * weight_skills,
          0
        ) +
        COALESCE(
          (1 - (e.experience_embedding <=> query_requirements_embedding)) * weight_experience,
          0
        ) +
        COALESCE(
          (1 - (e.education_embedding <=> query_requirements_embedding)) * weight_education,
          0
        )
      ) > match_threshold
    )
  ORDER BY weighted_similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_experts_by_multi_vector IS 'Finds experts with weighted multi-vector similarity matching using expertise_area, skills, experience, and education embeddings';

-- ============================================================================
-- Embedding Triggers
-- ============================================================================

-- Drop old trigger and function if they exist
DROP TRIGGER IF EXISTS auto_generate_expert_embedding ON experts;
DROP FUNCTION IF EXISTS trigger_generate_expert_embedding();

-- Create new trigger function for multi-embedding generation
CREATE OR REPLACE FUNCTION trigger_generate_all_expert_embeddings()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the function to generate all embeddings
  -- Note: This runs synchronously within the transaction
  PERFORM generate_all_expert_embeddings(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger on experts table for multi-embedding generation
CREATE TRIGGER auto_generate_all_expert_embeddings
AFTER INSERT OR UPDATE OF expertise_area, resume_skills, resume_education, resume_experience
ON experts
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION trigger_generate_all_expert_embeddings();

COMMENT ON FUNCTION trigger_generate_all_expert_embeddings IS 'Trigger function that automatically generates all embeddings (expertise_area, skills, education, experience) when expert profile data changes';

