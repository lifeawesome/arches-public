-- Clear hardcoded conversation titles to allow dynamic title generation
-- This ensures conversation titles are always shown relative to the viewer
-- (e.g., "Alice" sees "Bob", "Bob" sees "Alice")

-- Update all conversations to have NULL title
-- This allows the frontend to dynamically generate the title based on who's viewing
UPDATE conversations
SET title = NULL
WHERE title IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN conversations.title IS 'Optional custom title. If NULL, title is dynamically generated from other participant name';


