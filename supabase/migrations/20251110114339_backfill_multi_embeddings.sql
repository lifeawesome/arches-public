-- Backfill multi-embeddings for existing experts
-- This migration generates all embeddings for experts that don't have them yet

-- Function to backfill embeddings for a single expert
CREATE OR REPLACE FUNCTION backfill_expert_embeddings(expert_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Generate all embeddings for the expert
  PERFORM generate_all_expert_embeddings(expert_id);
END;
$$;

-- Backfill embeddings for all active experts that are missing any embeddings
-- NOTE: This backfill is skipped during migration to avoid API calls during db reset
-- To run the backfill, use the API endpoint /api/embeddings/generate?type=expert&batch=true
-- or call the backfill_expert_embeddings function manually for specific experts
--
-- Uncomment the DO block below to enable automatic backfill during migration
-- (not recommended for production as it makes external API calls)
/*
DO $$
DECLARE
  expert_record RECORD;
  processed_count INT := 0;
  error_count INT := 0;
BEGIN
  -- Process experts that are missing at least one embedding
  FOR expert_record IN 
    SELECT id 
    FROM experts 
    WHERE is_active = true 
      AND is_approved = true
      AND (
        expertise_area_embedding IS NULL OR
        skills_embedding IS NULL OR
        education_embedding IS NULL OR
        experience_embedding IS NULL
      )
    LIMIT 100  -- Process in batches to avoid overwhelming the API
  LOOP
    BEGIN
      PERFORM backfill_expert_embeddings(expert_record.id);
      processed_count := processed_count + 1;
      
      -- Add a small delay to avoid rate limiting
      IF processed_count % 10 = 0 THEN
        PERFORM pg_sleep(1);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING 'Error processing expert %: %', expert_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill completed: % processed, % errors', processed_count, error_count;
END;
$$;
*/

-- Add comment for documentation
COMMENT ON FUNCTION backfill_expert_embeddings IS 'Backfills all embeddings for a single expert. Can be called manually for specific experts or used in batch processing.';

-- Note: For large datasets, run this migration multiple times or use the API endpoint
-- with batch=true to process all experts gradually

