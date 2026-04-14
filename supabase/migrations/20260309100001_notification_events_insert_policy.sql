-- Allow system (SECURITY DEFINER functions) to insert notification_events.
-- Without this, create_notification_event() could not insert when called from
-- notify_circle_members_of_new_post(); RLS blocked INSERT because there was
-- no INSERT policy (only SELECT and UPDATE existed).

CREATE POLICY "System can insert notification events"
  ON notification_events
  FOR INSERT
  WITH CHECK (
    current_user NOT IN ('anon', 'authenticated')
  );

COMMENT ON POLICY "System can insert notification events" ON notification_events IS
  'Allows SECURITY DEFINER functions (postgres, supabase_admin, service_role) to create notifications for any user. Client roles cannot insert.';
