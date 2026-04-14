-- Add foreign key from circles.expert_id to profiles.id
-- This allows Supabase to properly join circles with their expert profiles

-- The circles table currently has a foreign key to auth.users(id)
-- We need to add an additional foreign key to profiles(id) for the PostgREST join to work
-- Since profiles.id is the same as auth.users.id, this is safe

ALTER TABLE circles
ADD CONSTRAINT circles_expert_id_profiles_fkey
FOREIGN KEY (expert_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT circles_expert_id_profiles_fkey ON circles IS
  'Foreign key to profiles table to enable PostgREST joins with expert profile data';

