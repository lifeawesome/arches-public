-- Add approval status for experts
ALTER TABLE experts ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE experts ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Create index for filtering approved experts
CREATE INDEX IF NOT EXISTS idx_experts_is_approved ON experts(is_approved);

-- Add comments
COMMENT ON COLUMN experts.is_approved IS 'Whether the expert has been vetted and approved by an admin';
COMMENT ON COLUMN experts.approved_at IS 'Timestamp when the expert was approved';
COMMENT ON COLUMN experts.approved_by IS 'Admin user ID who approved the expert';
COMMENT ON COLUMN experts.approval_notes IS 'Internal notes about the approval decision';

-- Update existing active experts to be approved (grandfather clause)
-- Comment this out if you don't want to auto-approve existing experts
UPDATE experts SET is_approved = TRUE WHERE is_active = TRUE;

