-- Add foreign key relationship between experts and profiles
-- This allows PostgREST to understand the relationship for joins

-- Add foreign key constraint from experts.user_id to profiles.id
-- Both reference auth.users.id, so this creates a direct relationship
ALTER TABLE experts 
ADD CONSTRAINT fk_experts_profiles 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Note: Index idx_experts_user_id already exists from 003_create_experts_table.sql
-- No need to create a duplicate index for the foreign key

-- Add comment for documentation
COMMENT ON CONSTRAINT fk_experts_profiles ON experts IS 
  'Foreign key to profiles table via user_id, allows PostgREST joins';

