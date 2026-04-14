-- NOTE: Vector extension should remain in public schema for ease of use
-- This migration only ensures http extension is in the dedicated extensions schema
-- 
-- Keeping vector in public schema means vector types are automatically accessible
-- without needing to fully qualify them (e.g., vector(1536) instead of extensions.vector(1536))
-- or modify search_path settings.

-- Create dedicated schema for extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on the schema to authenticated users (needed for functions using these extensions)
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- Ensure vector extension exists in public schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    -- Extension doesn't exist at all, create it in public schema
    CREATE EXTENSION vector WITH SCHEMA public;
  END IF;
  -- If extension already exists, leave it where it is
END $$;

-- Ensure http extension exists in public schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'http'
  ) THEN
    -- Extension doesn't exist at all, create it in public schema
    CREATE EXTENSION http WITH SCHEMA public;
  END IF;
  -- If extension already exists, leave it where it is
END $$;

-- Add comment for documentation
COMMENT ON SCHEMA extensions IS 'Dedicated schema for PostgreSQL extensions (reserved for future use, currently extensions are in public schema for ease of use)';

