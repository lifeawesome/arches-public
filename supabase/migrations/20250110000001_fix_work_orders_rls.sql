-- Fix infinite recursion in work_orders RLS policies
-- This replaces the circular dependency with simpler, more direct policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view own work orders" ON work_orders;
DROP POLICY IF EXISTS "Experts can view assigned work orders" ON work_orders;
DROP POLICY IF EXISTS "Experts can view available work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can view applications for their work orders" ON work_order_applications;

-- Recreate work_orders policies without circular dependency
-- Policy 1: Users can view work orders for their work requests
CREATE POLICY "Users can view own work orders" ON work_orders
  FOR SELECT USING (
    work_request_id IN (
      SELECT id FROM work_requests 
      WHERE user_id = auth.uid()
    )
  );

-- Policy 2: Experts can view work orders they're assigned to
CREATE POLICY "Experts can view assigned work orders" ON work_orders
  FOR SELECT USING (assigned_expert_id = auth.uid());

-- Policy 3: Anyone can view available work orders (for discovery)
CREATE POLICY "Experts can view available work orders" ON work_orders
  FOR SELECT USING (status IN ('pending', 'matching', 'matched'));

-- Recreate work_order_applications policy without circular dependency
CREATE POLICY "Users can view applications for their work orders" ON work_order_applications
  FOR SELECT USING (
    work_order_id IN (
      SELECT wo.id FROM work_orders wo
      WHERE wo.work_request_id IN (
        SELECT id FROM work_requests 
        WHERE user_id = auth.uid()
      )
    )
  );

