-- Notification Functions
-- All notification-related database functions for creating and processing notifications

-- Create notification creation function
CREATE OR REPLACE FUNCTION create_notification_event(
  p_user_id UUID,
  p_event_type notification_event_type,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_in_app_enabled BOOLEAN;
  v_email_enabled BOOLEAN;
  v_user_timezone TEXT;
  v_quiet_hours_start INTEGER;
  v_quiet_hours_end INTEGER;
  v_current_hour INTEGER;
  v_should_create BOOLEAN := false;
BEGIN
  -- Get user notification preferences
  SELECT 
    COALESCE(in_app_notifications, true),
    COALESCE(email_system_notifications, false),
    COALESCE(p.timezone, 'UTC'),
    COALESCE((p.notification_preferences->>'quiet_hours_start')::INTEGER, 22),
    COALESCE((p.notification_preferences->>'quiet_hours_end')::INTEGER, 7)
  INTO 
    v_in_app_enabled,
    v_email_enabled,
    v_user_timezone,
    v_quiet_hours_start,
    v_quiet_hours_end
  FROM user_notification_preferences unp
  LEFT JOIN profiles p ON p.id = p_user_id
  WHERE unp.user_id = p_user_id;

  -- If preferences don't exist, use defaults
  IF v_in_app_enabled IS NULL THEN
    v_in_app_enabled := true;
  END IF;
  IF v_email_enabled IS NULL THEN
    v_email_enabled := false;
  END IF;
  IF v_user_timezone IS NULL THEN
    v_user_timezone := 'UTC';
  END IF;

  -- Check if notification should be created based on channels
  IF 'in_app' = ANY(p_channels) AND v_in_app_enabled THEN
    v_should_create := true;
  ELSIF 'email' = ANY(p_channels) AND v_email_enabled THEN
    v_should_create := true;
  END IF;

  -- Check quiet hours for scheduled notifications
  IF p_scheduled_for IS NOT NULL THEN
    -- Get current hour in user's timezone
    v_current_hour := EXTRACT(HOUR FROM (p_scheduled_for AT TIME ZONE v_user_timezone));
    
    -- Check if within quiet hours
    IF v_quiet_hours_start > v_quiet_hours_end THEN
      -- Quiet hours span midnight (e.g., 22:00 - 07:00)
      IF v_current_hour >= v_quiet_hours_start OR v_current_hour < v_quiet_hours_end THEN
        v_should_create := false;
      END IF;
    ELSE
      -- Normal quiet hours (e.g., 22:00 - 07:00 doesn't apply here, use 22:00 - 23:59)
      IF v_current_hour >= v_quiet_hours_start AND v_current_hour < v_quiet_hours_end THEN
        v_should_create := false;
      END IF;
    END IF;
  END IF;

  -- High priority notifications always get created (override quiet hours)
  IF p_priority = 'high' THEN
    v_should_create := true;
  END IF;

  -- Create notification if conditions are met
  IF v_should_create THEN
    INSERT INTO notification_events (
      user_id,
      event_type,
      title,
      message,
      metadata,
      action_url,
      priority,
      scheduled_for,
      channels
    )
    VALUES (
      p_user_id,
      p_event_type,
      p_title,
      p_message,
      p_metadata,
      p_action_url,
      p_priority,
      p_scheduled_for,
      p_channels
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
  ELSE
    -- Return NULL if notification was not created due to preferences
    RETURN NULL;
  END IF;
END;
$$;

-- Create streak update function
CREATE OR REPLACE FUNCTION update_user_streak(
  p_user_id UUID,
  p_completion_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_streak INTEGER;
  v_best_streak INTEGER;
  v_last_activity_date DATE;
  v_previous_streak INTEGER;
  v_streak_increased BOOLEAN := false;
  v_milestone_reached BOOLEAN := false;
  v_milestone_type TEXT;
  v_result JSONB;
BEGIN
  -- Get current streak data
  SELECT 
    COALESCE(current_streak, 0),
    COALESCE(best_streak, 0),
    last_activity_date
  INTO 
    v_current_streak,
    v_best_streak,
    v_last_activity_date
  FROM user_streaks
  WHERE user_id = p_user_id;

  -- If no streak record exists, create one
  IF v_current_streak IS NULL THEN
    INSERT INTO user_streaks (user_id, current_streak, best_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, p_completion_date)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Get the newly created record
    SELECT current_streak, best_streak, last_activity_date
    INTO v_current_streak, v_best_streak, v_last_activity_date
    FROM user_streaks
    WHERE user_id = p_user_id;
  END IF;

  v_previous_streak := v_current_streak;

  -- Calculate streak
  IF v_last_activity_date IS NULL THEN
    -- First activity ever
    v_current_streak := 1;
    v_streak_increased := true;
  ELSIF v_last_activity_date = p_completion_date - INTERVAL '1 day' THEN
    -- Consecutive day - streak continues
    v_current_streak := v_current_streak + 1;
    v_streak_increased := true;
  ELSIF v_last_activity_date = p_completion_date THEN
    -- Same day - don't increment (already counted)
    -- Do nothing
  ELSE
    -- Streak broken - start over
    v_current_streak := 1;
  END IF;

  -- Update best streak if current is better
  IF v_current_streak > v_best_streak THEN
    v_best_streak := v_current_streak;
  END IF;

  -- Update user_streaks table
  INSERT INTO user_streaks (user_id, current_streak, best_streak, last_activity_date, updated_at)
  VALUES (p_user_id, v_current_streak, v_best_streak, p_completion_date, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    best_streak = EXCLUDED.best_streak,
    last_activity_date = EXCLUDED.last_activity_date,
    updated_at = EXCLUDED.updated_at;

  -- Check for milestones (7, 30, 50, 100, 365 days)
  IF v_streak_increased AND v_current_streak IN (7, 30, 50, 100, 365) THEN
    v_milestone_reached := true;
    
    -- Determine milestone type
    CASE v_current_streak
      WHEN 7 THEN v_milestone_type := 'week';
      WHEN 30 THEN v_milestone_type := 'month';
      WHEN 50 THEN v_milestone_type := 'fifty';
      WHEN 100 THEN v_milestone_type := 'hundred';
      WHEN 365 THEN v_milestone_type := 'year';
      ELSE v_milestone_type := 'other';
    END CASE;

    -- Create milestone notification
    PERFORM create_notification_event(
      p_user_id,
      'streak_milestone',
      'Streak Milestone! 🔥',
      format('Amazing! You''ve reached a %s-day streak! Keep it going!', v_current_streak),
      jsonb_build_object(
        'streak_count', v_current_streak,
        'milestone_type', v_milestone_type,
        'milestone_name', CASE v_milestone_type
          WHEN 'week' THEN 'One Week'
          WHEN 'month' THEN 'One Month'
          WHEN 'fifty' THEN 'Fifty Days'
          WHEN 'hundred' THEN 'One Hundred Days'
          WHEN 'year' THEN 'One Year'
          ELSE 'Milestone'
        END
      ),
      '/dashboard',
      'high',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
  END IF;

  -- Return result
  v_result := jsonb_build_object(
    'current_streak', v_current_streak,
    'best_streak', v_best_streak,
    'previous_streak', v_previous_streak,
    'streak_increased', v_streak_increased,
    'milestone_reached', v_milestone_reached,
    'milestone_type', v_milestone_type
  );

  RETURN v_result;
END;
$$;

-- Process daily task reminders
CREATE OR REPLACE FUNCTION process_daily_task_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_task_record RECORD;
  v_user_timezone TEXT;
  v_current_hour INTEGER;
  v_reminder_times INTEGER[];
  v_reminder_type notification_event_type;
  v_reminder_title TEXT;
  v_reminder_message TEXT;
  v_count INTEGER := 0;
BEGIN
  -- Get current UTC hour (will be converted to user timezone)
  v_current_hour := EXTRACT(HOUR FROM NOW());

  -- Process each user with incomplete tasks
  FOR v_user_record IN
    SELECT DISTINCT uti.user_id, p.timezone, p.notification_preferences
    FROM user_task_instances uti
    JOIN profiles p ON p.id = uti.user_id
    WHERE uti.status IN ('assigned', 'started')
      AND uti.assigned_for_date = CURRENT_DATE
      AND EXISTS (
        SELECT 1 FROM user_notification_preferences unp
        WHERE unp.user_id = uti.user_id
        AND COALESCE(unp.in_app_notifications, true) = true
      )
  LOOP
    -- Get user timezone and reminder preferences
    v_user_timezone := COALESCE(v_user_record.timezone, 'UTC');
    v_reminder_times := COALESCE(
      (v_user_record.notification_preferences->>'reminder_times')::INTEGER[],
      ARRAY[9, 14, 20]::INTEGER[]
    );

    -- Get current hour in user's timezone
    v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE v_user_timezone));

    -- Determine reminder type based on time
    IF v_current_hour = 9 OR (v_current_hour >= 8 AND v_current_hour <= 10 AND 9 = ANY(v_reminder_times)) THEN
      v_reminder_type := 'task_reminder_daily';
      v_reminder_title := 'Daily Task Reminder';
      v_reminder_message := 'Don''t forget your daily task!';
    ELSIF v_current_hour = 14 OR (v_current_hour >= 13 AND v_current_hour <= 15 AND 14 = ANY(v_reminder_times)) THEN
      v_reminder_type := 'task_reminder_afternoon';
      v_reminder_title := 'Afternoon Reminder';
      v_reminder_message := 'Still time to complete today''s task!';
    ELSIF v_current_hour = 20 OR (v_current_hour >= 19 AND v_current_hour <= 21 AND 20 = ANY(v_reminder_times)) THEN
      v_reminder_type := 'task_reminder_evening';
      v_reminder_title := 'Evening Reminder';
      v_reminder_message := 'Last chance! Complete your task before midnight!';
    ELSE
      -- Not a reminder time, skip
      CONTINUE;
    END IF;

    -- Get incomplete task for this user
    SELECT uti.id, uti.task_id, uti.pathway_id, t.title, t.xp_value
    INTO v_task_record
    FROM user_task_instances uti
    JOIN tasks t ON t.id = uti.task_id
    WHERE uti.user_id = v_user_record.user_id
      AND uti.status IN ('assigned', 'started')
      AND uti.assigned_for_date = CURRENT_DATE
    LIMIT 1;

    -- Create reminder notification if task found
    IF v_task_record.id IS NOT NULL THEN
      PERFORM create_notification_event(
        v_user_record.user_id,
        v_reminder_type,
        v_reminder_title,
        format('%s: %s', v_reminder_message, v_task_record.title),
        jsonb_build_object(
          'task_id', v_task_record.id,
          'task_title', v_task_record.title,
          'pathway_id', v_task_record.pathway_id,
          'days_pending', 0
        ),
        format('/dashboard/action?task=%s', v_task_record.id),
        'normal',
        NULL,
        ARRAY['in_app']::TEXT[]
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Check streak warnings (streak about to break)
CREATE OR REPLACE FUNCTION check_streak_warnings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_user_timezone TEXT;
  v_current_hour INTEGER;
  v_hours_until_midnight INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Process users with active streaks who haven't completed today's task
  FOR v_user_record IN
    SELECT 
      us.user_id,
      us.current_streak,
      p.timezone,
      CASE WHEN uti.id IS NULL THEN true ELSE false END as no_task_today
    FROM user_streaks us
    JOIN profiles p ON p.id = us.user_id
    LEFT JOIN user_task_instances uti ON uti.user_id = us.user_id
      AND uti.assigned_for_date = CURRENT_DATE
      AND uti.status = 'completed'
    WHERE us.current_streak > 0
      AND us.last_activity_date < CURRENT_DATE
      AND uti.id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_notification_preferences unp
        WHERE unp.user_id = us.user_id
        AND COALESCE(unp.in_app_notifications, true) = true
      )
  LOOP
    v_user_timezone := COALESCE(v_user_record.timezone, 'UTC');
    v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE v_user_timezone));

    -- Send warning at 11 PM user's timezone (23:00)
    IF v_current_hour = 23 THEN
      -- Calculate hours until midnight
      v_hours_until_midnight := 1;

      -- Create streak warning notification
      PERFORM create_notification_event(
        v_user_record.user_id,
        'streak_warning',
        'Streak Warning! ⚠️',
        format('Your %s-day streak ends in %s hour! Complete a task now!', 
               v_user_record.current_streak, 
               v_hours_until_midnight),
        jsonb_build_object(
          'current_streak', v_user_record.current_streak,
          'hours_remaining', v_hours_until_midnight
        ),
        '/dashboard',
        'high',
        NULL,
        ARRAY['in_app']::TEXT[]
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Check streak status (broken streaks)
CREATE OR REPLACE FUNCTION check_streak_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_previous_streak INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Find users whose streaks were broken (last activity was before yesterday)
  FOR v_user_record IN
    SELECT 
      us.user_id,
      us.current_streak,
      us.last_activity_date
    FROM user_streaks us
    WHERE us.current_streak > 0
      AND us.last_activity_date < CURRENT_DATE - INTERVAL '1 day'
      AND NOT EXISTS (
        SELECT 1 FROM user_task_instances uti
        WHERE uti.user_id = us.user_id
        AND uti.assigned_for_date >= us.last_activity_date
        AND uti.status = 'completed'
      )
      AND EXISTS (
        SELECT 1 FROM user_notification_preferences unp
        WHERE unp.user_id = us.user_id
        AND COALESCE(unp.in_app_notifications, true) = true
      )
  LOOP
    v_previous_streak := v_user_record.current_streak;

    -- Update streak to 0
    UPDATE user_streaks
    SET current_streak = 0,
        updated_at = NOW()
    WHERE user_id = v_user_record.user_id;

    -- Create streak broken notification
    PERFORM create_notification_event(
      v_user_record.user_id,
      'streak_broken',
      'Streak Ended',
      format('Your %s-day streak ended. Start a new one today!', v_previous_streak),
      jsonb_build_object(
        'previous_streak_count', v_previous_streak,
        'broken_date', CURRENT_DATE
      ),
      '/dashboard',
      'normal',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Process comeback reminders (inactive users)
CREATE OR REPLACE FUNCTION process_comeback_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_days_inactive INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Find users inactive for 3+ days
  FOR v_user_record IN
    SELECT 
      us.user_id,
      us.last_activity_date,
      CURRENT_DATE - us.last_activity_date as days_inactive
    FROM user_streaks us
    WHERE us.last_activity_date < CURRENT_DATE - INTERVAL '3 days'
      AND EXISTS (
        SELECT 1 FROM user_notification_preferences unp
        WHERE unp.user_id = us.user_id
        AND COALESCE(unp.in_app_notifications, true) = true
      )
  LOOP
    v_days_inactive := v_user_record.days_inactive;

    -- Create comeback reminder notification
    PERFORM create_notification_event(
      v_user_record.user_id,
      'comeback_reminder',
      'We Miss You!',
      format('We miss you! Come back and continue your journey. You''ve been away for %s days.', v_days_inactive),
      jsonb_build_object(
        'days_inactive', v_days_inactive,
        'last_activity_date', v_user_record.last_activity_date
      ),
      '/dashboard',
      'normal',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Process weekly summaries
CREATE OR REPLACE FUNCTION process_weekly_summaries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_record RECORD;
  v_user_timezone TEXT;
  v_current_day_of_week INTEGER;
  v_tasks_completed INTEGER;
  v_xp_earned INTEGER;
  v_streak_days INTEGER;
  v_week_start DATE;
  v_week_end DATE;
  v_count INTEGER := 0;
BEGIN
  -- Only run on Sunday (day 0)
  v_current_day_of_week := EXTRACT(DOW FROM NOW());
  
  IF v_current_day_of_week != 0 THEN
    RETURN 0; -- Not Sunday, skip
  END IF;

  -- Calculate week range (Sunday to Saturday)
  v_week_end := CURRENT_DATE;
  v_week_start := v_week_end - INTERVAL '6 days';

  -- Process each active user
  FOR v_user_record IN
    SELECT DISTINCT p.id as user_id, p.timezone
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM user_task_instances uti
      WHERE uti.user_id = p.id
      AND uti.assigned_for_date >= v_week_start
      AND uti.assigned_for_date <= v_week_end
    )
    AND EXISTS (
      SELECT 1 FROM user_notification_preferences unp
      WHERE unp.user_id = p.id
      AND COALESCE(unp.in_app_notifications, true) = true
    )
  LOOP
    v_user_timezone := COALESCE(v_user_record.timezone, 'UTC');
    
    -- Check if it's Sunday 6 PM in user's timezone
    IF EXTRACT(HOUR FROM (NOW() AT TIME ZONE v_user_timezone)) = 18 THEN
      -- Count tasks completed this week
      SELECT COUNT(*)
      INTO v_tasks_completed
      FROM user_task_instances
      WHERE user_id = v_user_record.user_id
        AND status = 'completed'
        AND assigned_for_date >= v_week_start
        AND assigned_for_date <= v_week_end;

      -- Calculate XP earned this week
      SELECT COALESCE(SUM(xp_delta), 0)
      INTO v_xp_earned
      FROM user_xp_ledger
      WHERE user_id = v_user_record.user_id
        AND created_at >= v_week_start
        AND created_at <= v_week_end + INTERVAL '1 day';

      -- Get current streak
      SELECT COALESCE(current_streak, 0)
      INTO v_streak_days
      FROM user_streaks
      WHERE user_id = v_user_record.user_id;

      -- Create weekly summary notification
      PERFORM create_notification_event(
        v_user_record.user_id,
        'weekly_summary',
        'Weekly Summary 📊',
        format('Your week: %s tasks, %s XP, %s day streak!', 
               v_tasks_completed, v_xp_earned, v_streak_days),
        jsonb_build_object(
          'week_start', v_week_start,
          'week_end', v_week_end,
          'tasks_completed', v_tasks_completed,
          'xp_earned', v_xp_earned,
          'streak_days', v_streak_days
        ),
        '/dashboard/progress',
        'normal',
        NULL,
        ARRAY['in_app']::TEXT[]
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Process notification queue
CREATE OR REPLACE FUNCTION process_notification_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_item RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Process pending notifications where scheduled_for <= NOW()
  FOR v_queue_item IN
    SELECT id, user_id, event_type, metadata, scheduled_for
    FROM notification_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 100 -- Process in batches
  LOOP
    -- Mark as processing
    UPDATE notification_queue
    SET status = 'processing'
    WHERE id = v_queue_item.id;

    -- Create notification event (function will handle preferences)
    PERFORM create_notification_event(
      v_queue_item.user_id,
      v_queue_item.event_type,
      'Notification',
      'You have a notification',
      v_queue_item.metadata,
      NULL,
      'normal',
      v_queue_item.scheduled_for,
      ARRAY['in_app']::TEXT[]
    );

    -- Mark as sent
    UPDATE notification_queue
    SET status = 'sent'
    WHERE id = v_queue_item.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Comments
COMMENT ON FUNCTION create_notification_event IS 'Creates a notification event after checking user preferences, timezone, and quiet hours. Returns notification ID or NULL if not created.';
COMMENT ON FUNCTION update_user_streak IS 'Updates user streak based on completion date. Creates milestone notifications for 7, 30, 50, 100, and 365 day streaks.';
COMMENT ON FUNCTION process_daily_task_reminders IS 'Processes daily task reminders based on user timezone and reminder preferences. Called hourly by cron job.';
COMMENT ON FUNCTION check_streak_warnings IS 'Checks for streaks about to break and creates warning notifications. Called hourly by cron job.';
COMMENT ON FUNCTION check_streak_status IS 'Checks for broken streaks and creates streak_broken notifications. Called daily by cron job.';
COMMENT ON FUNCTION process_comeback_reminders IS 'Processes comeback reminders for inactive users (3+ days). Called daily by cron job.';
COMMENT ON FUNCTION process_weekly_summaries IS 'Creates weekly summary notifications on Sunday evening. Called weekly by cron job.';
COMMENT ON FUNCTION process_notification_queue IS 'Processes pending scheduled notifications from notification_queue table. Called every 15 minutes by cron job.';
