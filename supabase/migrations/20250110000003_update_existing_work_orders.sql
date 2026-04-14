-- Update existing work orders to set payment fields
-- This ensures any work orders created before the payment system was added
-- have the correct default values

UPDATE work_orders
SET 
  payment_required = (budget_allocated IS NOT NULL AND budget_allocated > 0),
  payment_amount = budget_allocated,
  payment_status = 'unpaid'
WHERE payment_status IS NULL;

-- Add a comment to track this data migration
COMMENT ON TABLE work_orders IS 'Individual work items with payment and escrow support. Updated 2025-01-10 to initialize payment fields.';

