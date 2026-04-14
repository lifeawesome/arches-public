-- Note: subscriptions.id already has a PRIMARY KEY constraint (subscriptions_pkey)
-- which enforces uniqueness, so no additional unique constraint is needed

-- Add unique constraint to prevent multiple active subscriptions per user
-- (This allows users to have multiple subscriptions but prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id_active 
ON subscriptions (user_id) 
WHERE status IN ('active', 'trialing', 'past_due');

-- Add comment to document the constraint
COMMENT ON INDEX idx_subscriptions_user_id_active IS 'Ensures only one active subscription per user';
