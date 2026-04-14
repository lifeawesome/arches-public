-- Fix duplicate indexes across tables
-- This migration consolidates all duplicate index fixes into a single file

-- ============================================================================
-- experts table - Drop duplicate user_id index
-- ============================================================================
-- Drop duplicate index on experts.user_id
-- Both idx_experts_user_id and idx_experts_user_id_fk index the same column
-- Keep idx_experts_user_id (created in 003_create_experts_table.sql) and drop idx_experts_user_id_fk
DROP INDEX IF EXISTS idx_experts_user_id_fk;

COMMENT ON INDEX idx_experts_user_id IS 
  'Index on experts.user_id for performance. Also supports foreign key to profiles table.';

-- ============================================================================
-- subscriptions table - Drop duplicate unique constraint
-- ============================================================================
-- Drop duplicate unique constraint on subscriptions.id
-- The subscriptions_pkey (PRIMARY KEY) already enforces uniqueness on the id column
-- The subscriptions_id_unique constraint is redundant
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_id_unique;

COMMENT ON CONSTRAINT subscriptions_pkey ON subscriptions IS 
  'Primary key on subscriptions.id. Already enforces uniqueness, no additional unique constraint needed.';

