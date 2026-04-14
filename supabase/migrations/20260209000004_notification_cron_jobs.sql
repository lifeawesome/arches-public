-- Create pg_cron scheduled jobs for notification processing
-- Note: pg_cron extension must be enabled in Supabase
-- If pg_cron is not available, use Supabase Edge Functions with external cron instead

-- Enable pg_cron extension (if available)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run every hour: Process daily task reminders
-- SELECT cron.schedule(
--   'process-task-reminders',
--   '0 * * * *', -- Every hour at minute 0
--   $$SELECT process_daily_task_reminders()$$
-- );

-- Run every hour: Check streak warnings
-- SELECT cron.schedule(
--   'check-streak-warnings',
--   '0 * * * *', -- Every hour at minute 0
--   $$SELECT check_streak_warnings()$$
-- );

-- Run daily at midnight UTC: Check streak status
-- SELECT cron.schedule(
--   'check-streak-status',
--   '0 0 * * *', -- Daily at midnight UTC
--   $$SELECT check_streak_status()$$
-- );

-- Run daily at 10 AM UTC: Process comeback reminders
-- SELECT cron.schedule(
--   'process-comeback-reminders',
--   '0 10 * * *', -- Daily at 10 AM UTC
--   $$SELECT process_comeback_reminders()$$
-- );

-- Run weekly on Sunday at 6 PM UTC: Process weekly summaries
-- SELECT cron.schedule(
--   'process-weekly-summaries',
--   '0 18 * * 0', -- Sunday at 6 PM UTC
--   $$SELECT process_weekly_summaries()$$
-- );

-- Run every 15 minutes: Process notification queue
-- SELECT cron.schedule(
--   'process-notification-queue',
--   '*/15 * * * *', -- Every 15 minutes
--   $$SELECT process_notification_queue()$$
-- );

-- Note: The above cron jobs are commented out because pg_cron may not be available
-- in all Supabase instances. Alternative approaches:
-- 1. Use Supabase Edge Functions with external cron (GitHub Actions, Vercel Cron, etc.)
-- 2. Use a background job service
-- 3. Call functions manually for testing

COMMENT ON TABLE notification_queue IS 'Queue for scheduled notifications. Process using process_notification_queue() function called by cron job or Edge Function.';
