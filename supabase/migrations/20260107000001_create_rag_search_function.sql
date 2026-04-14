-- RAG Chatbot: Create vector search function for content embeddings
-- This migration creates the RPC function for semantic search across all content types

-- ============================================================================
-- Vector Search Function
-- ============================================================================

CREATE OR REPLACE FUNCTION search_content_embeddings(
  query_embedding vector(1536),
  content_types TEXT[] DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id TEXT,
  title TEXT,
  content_text TEXT,
  metadata JSONB,
  source_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.content_type,
    ce.content_id,
    ce.title,
    ce.content_text,
    ce.metadata,
    ce.source_url,
    1 - (ce.embedding <=> query_embedding) as similarity
  FROM content_embeddings ce
  WHERE 
    ce.embedding IS NOT NULL
    AND (
      content_types IS NULL 
      OR ce.content_type = ANY(content_types)
    )
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_content_embeddings IS 'Search content embeddings using vector similarity. Supports filtering by content types and returns ranked results.';

-- ============================================================================
-- Hybrid Search Function (Vector + Keyword)
-- ============================================================================

CREATE OR REPLACE FUNCTION search_content_hybrid(
  query_embedding vector(1536),
  keyword_query TEXT DEFAULT NULL,
  content_types TEXT[] DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id TEXT,
  title TEXT,
  content_text TEXT,
  metadata JSONB,
  source_url TEXT,
  similarity FLOAT,
  keyword_rank FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keyword_weight FLOAT := 1 - vector_weight;
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      ce.id,
      ce.content_type,
      ce.content_id,
      ce.title,
      ce.content_text,
      ce.metadata,
      ce.source_url,
      1 - (ce.embedding <=> query_embedding) as vec_similarity
    FROM content_embeddings ce
    WHERE 
      ce.embedding IS NOT NULL
      AND (
        content_types IS NULL 
        OR ce.content_type = ANY(content_types)
      )
      AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ),
  keyword_results AS (
    SELECT 
      ce.id,
      ts_rank(
        to_tsvector('english', ce.title || ' ' || ce.content_text),
        plainto_tsquery('english', COALESCE(keyword_query, ''))
      ) as kw_rank
    FROM content_embeddings ce
    WHERE 
      keyword_query IS NOT NULL 
      AND keyword_query != ''
      AND (
        content_types IS NULL 
        OR ce.content_type = ANY(content_types)
      )
      AND to_tsvector('english', ce.title || ' ' || ce.content_text) @@ plainto_tsquery('english', keyword_query)
  )
  SELECT 
    vr.id,
    vr.content_type,
    vr.content_id,
    vr.title,
    vr.content_text,
    vr.metadata,
    vr.source_url,
    vr.vec_similarity as similarity,
    COALESCE(kr.kw_rank, 0) as keyword_rank,
    (vr.vec_similarity * vector_weight + COALESCE(kr.kw_rank, 0) * keyword_weight) as combined_score
  FROM vector_results vr
  LEFT JOIN keyword_results kr ON vr.id = kr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_content_hybrid IS 'Hybrid search combining vector similarity and keyword matching. Supports weighting between vector and keyword scores.';

-- ============================================================================
-- Search by Content Type Function
-- ============================================================================

CREATE OR REPLACE FUNCTION search_content_by_type(
  query_embedding vector(1536),
  target_content_type TEXT,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id TEXT,
  title TEXT,
  content_text TEXT,
  metadata JSONB,
  source_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ce.id,
    ce.content_type,
    ce.content_id,
    ce.title,
    ce.content_text,
    ce.metadata,
    ce.source_url,
    1 - (ce.embedding <=> query_embedding) as similarity
  FROM content_embeddings ce
  WHERE 
    ce.embedding IS NOT NULL
    AND ce.content_type = target_content_type
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_content_by_type IS 'Search content embeddings filtered by a specific content type.';

-- ============================================================================
-- Upsert Content Embedding Function
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_content_embedding(
  p_content_type TEXT,
  p_content_id TEXT,
  p_title TEXT,
  p_content_text TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_embedding vector(1536) DEFAULT NULL,
  p_source_url TEXT DEFAULT NULL
)
RETURNS content_embeddings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result content_embeddings;
BEGIN
  INSERT INTO content_embeddings (
    content_type,
    content_id,
    title,
    content_text,
    metadata,
    embedding,
    source_url
  ) VALUES (
    p_content_type,
    p_content_id,
    p_title,
    p_content_text,
    p_metadata,
    p_embedding,
    p_source_url
  )
  ON CONFLICT (content_type, content_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    content_text = EXCLUDED.content_text,
    metadata = EXCLUDED.metadata,
    embedding = COALESCE(EXCLUDED.embedding, content_embeddings.embedding),
    source_url = EXCLUDED.source_url,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION upsert_content_embedding IS 'Insert or update a content embedding. If embedding is NULL on update, preserves existing embedding.';

-- ============================================================================
-- Delete Content Embedding Function
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_content_embedding(
  p_content_type TEXT,
  p_content_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM content_embeddings
  WHERE content_type = p_content_type AND content_id = p_content_id;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

COMMENT ON FUNCTION delete_content_embedding IS 'Delete a content embedding by type and ID.';

