-- Circle Notification Events
-- Adds Circle-related notification_event_type enum values

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_post_created';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_comment_created';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_post_approved';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_post_rejected';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_user_mentioned';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_member_joined';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_role_changed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'circle_reaction_added';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

