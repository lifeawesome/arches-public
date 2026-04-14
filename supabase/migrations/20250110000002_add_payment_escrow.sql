-- Add payment and escrow functionality for work orders
-- This enables prepayment with funds held in escrow until work completion

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',        -- Payment initiated but not completed
  'authorized',     -- Payment authorized (card hold)
  'captured',       -- Payment captured
  'escrowed',       -- Funds in escrow
  'released',       -- Funds released to expert
  'refunded',       -- Payment refunded to client
  'failed'          -- Payment failed
);

-- Escrow status enum
CREATE TYPE escrow_status AS ENUM (
  'pending',        -- Awaiting funding
  'funded',         -- Funds deposited in escrow
  'disputed',       -- Dispute raised
  'releasing',      -- Release in progress
  'released',       -- Released to expert
  'refunding',      -- Refund in progress
  'refunded'        -- Refunded to client
);

-- Work order payments table
CREATE TABLE IF NOT EXISTS work_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_request_id UUID NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
  
  -- Parties
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expert_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Payment details
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'USD',
  payment_method TEXT, -- 'card', 'bank', 'wallet', etc.
  
  -- Status tracking
  payment_status payment_status DEFAULT 'pending',
  escrow_status escrow_status DEFAULT 'pending',
  
  -- External payment processor IDs
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  
  -- Escrow management
  funded_at TIMESTAMP WITH TIME ZONE,
  release_requested_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Dispute handling
  dispute_reason TEXT,
  dispute_notes TEXT,
  disputed_at TIMESTAMP WITH TIME ZONE,
  dispute_resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT work_order_payments_amount_positive CHECK (amount > 0)
);

-- Escrow transactions (detailed ledger)
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES work_order_payments(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type TEXT NOT NULL, -- 'deposit', 'release', 'refund', 'fee'
  amount INTEGER NOT NULL, -- Amount in cents (can be negative for debits)
  currency TEXT DEFAULT 'USD',
  
  -- Parties involved
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Description
  description TEXT NOT NULL,
  reference_id TEXT, -- External reference (Stripe transfer ID, etc.)
  
  -- Balance tracking
  balance_before INTEGER,
  balance_after INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Payment milestones (optional - for staged payments)
CREATE TABLE IF NOT EXISTS payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES work_order_payments(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  
  -- Milestone details
  milestone_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  percentage DECIMAL(5,2), -- Percentage of total payment
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'approved', 'paid'
  
  -- Deliverables
  deliverable_description TEXT,
  deliverable_url TEXT,
  
  -- Approval
  completed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT payment_milestones_amount_positive CHECK (amount > 0),
  CONSTRAINT payment_milestones_percentage_valid CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_payments_work_order ON work_order_payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_work_request ON work_order_payments(work_request_id);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_client ON work_order_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_expert ON work_order_payments(expert_id);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_payment_status ON work_order_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_escrow_status ON work_order_payments(escrow_status);
CREATE INDEX IF NOT EXISTS idx_work_order_payments_stripe_payment_intent ON work_order_payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_payment ON escrow_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_from_user ON escrow_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_to_user ON escrow_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_type ON escrow_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_payment ON payment_milestones(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_work_order ON payment_milestones(work_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON payment_milestones(status);

-- Updated_at trigger for payments
CREATE OR REPLACE FUNCTION update_work_order_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_work_order_payments_updated_at
  BEFORE UPDATE ON work_order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_payments_updated_at();

-- Updated_at trigger for milestones
CREATE OR REPLACE FUNCTION update_payment_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_milestones_updated_at
  BEFORE UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_milestones_updated_at();

-- Function to create escrow transaction when payment status changes
CREATE OR REPLACE FUNCTION create_escrow_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- When payment moves to escrowed, create deposit transaction
  IF NEW.escrow_status = 'funded' AND (OLD.escrow_status IS NULL OR OLD.escrow_status != 'funded') THEN
    INSERT INTO escrow_transactions (
      payment_id,
      transaction_type,
      amount,
      currency,
      from_user_id,
      description
    ) VALUES (
      NEW.id,
      'deposit',
      NEW.amount,
      NEW.currency,
      NEW.client_id,
      'Funds deposited to escrow for work order #' || (SELECT order_number FROM work_orders WHERE id = NEW.work_order_id)
    );
  END IF;
  
  -- When escrow releases, create release transaction
  IF NEW.escrow_status = 'released' AND OLD.escrow_status != 'released' THEN
    INSERT INTO escrow_transactions (
      payment_id,
      transaction_type,
      amount,
      currency,
      to_user_id,
      description,
      reference_id
    ) VALUES (
      NEW.id,
      'release',
      NEW.amount,
      NEW.currency,
      NEW.expert_id,
      'Funds released to expert for completed work order',
      NEW.stripe_transfer_id
    );
  END IF;
  
  -- When refunded, create refund transaction
  IF NEW.escrow_status = 'refunded' AND OLD.escrow_status != 'refunded' THEN
    INSERT INTO escrow_transactions (
      payment_id,
      transaction_type,
      amount,
      currency,
      to_user_id,
      description
    ) VALUES (
      NEW.id,
      'refund',
      NEW.amount,
      NEW.currency,
      NEW.client_id,
      'Funds refunded to client'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_escrow_transaction
  AFTER UPDATE OF escrow_status ON work_order_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_escrow_transaction();

-- RLS Policies
ALTER TABLE work_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;

-- Work Order Payments Policies
-- Clients can view their own payments
CREATE POLICY "Clients can view own payments" ON work_order_payments
  FOR SELECT USING (client_id = auth.uid());

-- Experts can view payments for their work orders
CREATE POLICY "Experts can view their payments" ON work_order_payments
  FOR SELECT USING (expert_id = auth.uid());

-- Clients can create payments for their work requests
CREATE POLICY "Clients can create payments" ON work_order_payments
  FOR INSERT WITH CHECK (client_id = auth.uid());

-- Only payment system can update (via API with service role)
-- Users can't directly update payments

-- Escrow Transactions Policies
-- Users can view transactions they're involved in
CREATE POLICY "Users can view own transactions" ON escrow_transactions
  FOR SELECT USING (
    from_user_id = auth.uid() OR 
    to_user_id = auth.uid() OR
    payment_id IN (
      SELECT id FROM work_order_payments 
      WHERE client_id = auth.uid() OR expert_id = auth.uid()
    )
  );

-- Payment Milestones Policies
-- Users can view milestones for their payments
CREATE POLICY "Users can view payment milestones" ON payment_milestones
  FOR SELECT USING (
    payment_id IN (
      SELECT id FROM work_order_payments 
      WHERE client_id = auth.uid() OR expert_id = auth.uid()
    )
  );

-- Add payment tracking fields to work_orders
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_amount INTEGER,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'pending', 'escrowed', 'completed'
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Add index
CREATE INDEX IF NOT EXISTS idx_work_orders_payment_status ON work_orders(payment_status);

-- Comments for documentation
COMMENT ON TABLE work_order_payments IS 'Payment records for work orders with escrow functionality';
COMMENT ON TABLE escrow_transactions IS 'Detailed ledger of all escrow transactions';
COMMENT ON TABLE payment_milestones IS 'Optional milestone-based payments for work orders';
COMMENT ON COLUMN work_order_payments.escrow_status IS 'Current status of funds in escrow';
COMMENT ON COLUMN work_order_payments.stripe_payment_intent_id IS 'Stripe Payment Intent ID for tracking';

