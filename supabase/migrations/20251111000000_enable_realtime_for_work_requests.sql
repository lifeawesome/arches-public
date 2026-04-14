-- Enable real-time for work requests and work orders tables
-- This allows real-time subscriptions to work for work request updates

-- Set REPLICA IDENTITY to FULL for DELETE events to work properly
ALTER TABLE public.work_requests REPLICA IDENTITY FULL;
ALTER TABLE public.work_orders REPLICA IDENTITY FULL;

-- Enable real-time for work_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE work_requests;

-- Enable real-time for work_orders table
ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;

-- Add comments for documentation
COMMENT ON PUBLICATION supabase_realtime IS 'Real-time publication includes work requests and work orders tables for live updates';

