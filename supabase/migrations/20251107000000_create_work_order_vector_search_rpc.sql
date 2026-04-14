-- Create stored procedure for vector similarity search on work orders
-- This function enables semantic search of work orders by title/description
-- It joins with work_requests to filter by user_id

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
  FROM work_orders wo
  INNER JOIN work_requests wr ON wo.work_request_id = wr.id
  WHERE 
    wr.user_id = p_user_id
    AND wo.requirements_embedding IS NOT NULL
    AND 1 - (wo.requirements_embedding <=> query_embedding) > match_threshold
  ORDER BY wo.requirements_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION search_work_orders_by_vector IS 'Finds work orders with similar requirements embeddings using cosine similarity, filtered by user_id through work_requests';

