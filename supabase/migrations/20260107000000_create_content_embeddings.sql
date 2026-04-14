-- RAG Chatbot: Create unified content embeddings table
-- This migration creates a unified table for storing embeddings of all content types
-- to enable semantic search across experts, posts, articles, courses, events, circles, etc.

-- ============================================================================
-- Content Embeddings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique content per type
  CONSTRAINT unique_content_type_id UNIQUE (content_type, content_id)
);

-- Add check constraint for valid content types
ALTER TABLE content_embeddings
ADD CONSTRAINT valid_content_type CHECK (
  content_type IN (
    'expert',
    'post',
    'article', 
    'course',
    'event',
    'circle',
    'guide',
    'success_story',
    'podcast'
  )
);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_content_embeddings_embedding 
ON content_embeddings USING hnsw (embedding vector_cosine_ops);

-- Create index for content type filtering
CREATE INDEX IF NOT EXISTS idx_content_embeddings_content_type 
ON content_embeddings (content_type);

-- Create index for content lookup
CREATE INDEX IF NOT EXISTS idx_content_embeddings_content_id 
ON content_embeddings (content_type, content_id);

-- Create index for full-text search on title and content
CREATE INDEX IF NOT EXISTS idx_content_embeddings_title_gin 
ON content_embeddings USING gin (to_tsvector('english', title));

-- Add comments for documentation
COMMENT ON TABLE content_embeddings IS 'Unified table for storing embeddings of all content types for RAG chatbot semantic search';
COMMENT ON COLUMN content_embeddings.content_type IS 'Type of content: expert, post, article, course, event, circle, guide, success_story, podcast';
COMMENT ON COLUMN content_embeddings.content_id IS 'ID from source system (Sanity _id or Supabase UUID)';
COMMENT ON COLUMN content_embeddings.title IS 'Title of the content for display';
COMMENT ON COLUMN content_embeddings.content_text IS 'Full text content used for embedding generation';
COMMENT ON COLUMN content_embeddings.metadata IS 'Type-specific metadata (author, tags, skills, etc.)';
COMMENT ON COLUMN content_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN content_embeddings.source_url IS 'URL to the original content for citations';

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_content_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_embeddings_updated_at
BEFORE UPDATE ON content_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_content_embeddings_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all content embeddings
CREATE POLICY "Authenticated users can read content embeddings"
ON content_embeddings FOR SELECT
TO authenticated
USING (true);

-- Allow anon users to read content embeddings (for public content discovery)
CREATE POLICY "Anon users can read content embeddings"
ON content_embeddings FOR SELECT
TO anon
USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage content embeddings"
ON content_embeddings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

