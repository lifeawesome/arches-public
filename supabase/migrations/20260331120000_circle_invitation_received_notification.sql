-- In-app notification when an existing user is invited to a circle by email (issue #154)

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_invitation_received';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
