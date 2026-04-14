-- Notification Triggers
-- Database triggers for task completion, achievements, and XP milestones

-- Trigger for task completion
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title TEXT;
  v_task_xp INTEGER;
  v_pathway_id UUID;
  v_total_xp INTEGER;
  v_completion_date DATE;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get task details
    SELECT t.title, t.xp_value, NEW.pathway_id
    INTO v_task_title, v_task_xp, v_pathway_id
    FROM tasks t
    WHERE t.id = NEW.task_id;

    -- Get completion date
    v_completion_date := COALESCE(NEW.completed_at::DATE, CURRENT_DATE);

    -- Calculate total XP
    SELECT COALESCE(SUM(xp_delta), 0)
    INTO v_total_xp
    FROM user_xp_ledger
    WHERE user_id = NEW.user_id;

    -- Create task completed notification
    PERFORM create_notification_event(
      NEW.user_id,
      'task_completed',
      'Task Completed! 🎉',
      format('Great job! You completed "%s" and earned %s XP!', v_task_title, v_task_xp),
      jsonb_build_object(
        'task_id', NEW.id,
        'task_title', v_task_title,
        'pathway_id', v_pathway_id,
        'xp_earned', v_task_xp,
        'total_xp', v_total_xp + v_task_xp
      ),
      '/dashboard/progress',
      'normal',
      NULL,
      ARRAY['in_app']::TEXT[]
    );

    -- Update user streak
    PERFORM update_user_streak(NEW.user_id, v_completion_date);

    -- Check for level up (this would require a level calculation function)
    -- For now, we'll handle this in a separate trigger or function
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for task completion
DROP TRIGGER IF EXISTS trigger_task_completion_notification ON user_task_instances;
CREATE TRIGGER trigger_task_completion_notification
  AFTER UPDATE OF status ON user_task_instances
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
  EXECUTE FUNCTION handle_task_completion();

-- Trigger for achievement unlock
CREATE OR REPLACE FUNCTION handle_achievement_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achievement_name TEXT;
  v_achievement_description TEXT;
BEGIN
  -- Get achievement details
  SELECT a.slug, a.description
  INTO v_achievement_name, v_achievement_description
  FROM achievements a
  WHERE a.id = NEW.achievement_id;

  -- Create achievement unlocked notification
  PERFORM create_notification_event(
    NEW.user_id,
    'achievement_unlocked',
    'Achievement Unlocked! 🏆',
    format('Achievement Unlocked: %s!', v_achievement_name),
    jsonb_build_object(
      'achievement_id', NEW.achievement_id,
      'achievement_name', v_achievement_name,
      'achievement_description', v_achievement_description
    ),
    '/dashboard/achievements',
    'high',
    NULL,
    ARRAY['in_app']::TEXT[]
  );

  RETURN NEW;
END;
$$;

-- Create trigger for achievement unlock
DROP TRIGGER IF EXISTS trigger_achievement_unlock_notification ON user_achievements;
CREATE TRIGGER trigger_achievement_unlock_notification
  AFTER INSERT ON user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION handle_achievement_unlock();

-- Function to check for level up (called after XP is added)
CREATE OR REPLACE FUNCTION check_level_up(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_xp INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Calculate total XP
  SELECT COALESCE(SUM(xp_delta), 0)
  INTO v_total_xp
  FROM user_xp_ledger
  WHERE user_id = p_user_id;

  -- Simple level calculation: 1000 XP per level (can be customized)
  v_current_level := FLOOR(v_total_xp / 1000);
  
  -- Check if level increased (this would need to track previous level)
  -- For MVP, we'll create a simple notification when reaching level milestones
  -- A more sophisticated system would track user level in a separate table
  
  -- Create level up notification for milestone levels (5, 10, 20, 50, 100)
  IF v_current_level IN (5, 10, 20, 50, 100) AND v_total_xp % 1000 < 100 THEN
    PERFORM create_notification_event(
      p_user_id,
      'level_up',
      'Level Up! 🎉',
      format('Level Up! You''re now Level %s!', v_current_level),
      jsonb_build_object(
        'new_level', v_current_level,
        'total_xp', v_total_xp
      ),
      '/dashboard/progress',
      'high',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Trigger for XP milestones
CREATE OR REPLACE FUNCTION handle_xp_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_xp INTEGER;
  v_milestone_xp INTEGER;
BEGIN
  -- Calculate total XP after this addition
  SELECT COALESCE(SUM(xp_delta), 0)
  INTO v_total_xp
  FROM user_xp_ledger
  WHERE user_id = NEW.user_id;

  -- Check for XP milestones (1000, 5000, 10000, 25000, 50000, 100000)
  IF v_total_xp >= 1000 AND v_total_xp < 10000 AND v_total_xp % 1000 < NEW.xp_delta THEN
    v_milestone_xp := FLOOR(v_total_xp / 1000) * 1000;
    
    PERFORM create_notification_event(
      NEW.user_id,
      'xp_milestone',
      'XP Milestone! 🌟',
      format('You''ve earned %s XP total! Incredible progress!', v_total_xp),
      jsonb_build_object(
        'total_xp', v_total_xp,
        'milestone_xp', v_milestone_xp
      ),
      '/dashboard/progress',
      'normal',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
  ELSIF v_total_xp >= 10000 AND v_total_xp % 5000 < NEW.xp_delta THEN
    v_milestone_xp := FLOOR(v_total_xp / 5000) * 5000;
    
    PERFORM create_notification_event(
      NEW.user_id,
      'xp_milestone',
      'XP Milestone! 🌟',
      format('You''ve earned %s XP total! Incredible progress!', v_total_xp),
      jsonb_build_object(
        'total_xp', v_total_xp,
        'milestone_xp', v_milestone_xp
      ),
      '/dashboard/progress',
      'normal',
      NULL,
      ARRAY['in_app']::TEXT[]
    );
  END IF;

  -- Check for level up
  PERFORM check_level_up(NEW.user_id);

  RETURN NEW;
END;
$$;

-- Create trigger for XP milestones
DROP TRIGGER IF EXISTS trigger_xp_milestone_notification ON user_xp_ledger;
CREATE TRIGGER trigger_xp_milestone_notification
  AFTER INSERT ON user_xp_ledger
  FOR EACH ROW
  EXECUTE FUNCTION handle_xp_milestone();

-- Comments
COMMENT ON FUNCTION handle_task_completion IS 'Trigger function that creates task_completed notification and updates streak when a task is completed.';
COMMENT ON FUNCTION handle_achievement_unlock IS 'Trigger function that creates achievement_unlocked notification when user earns an achievement.';
COMMENT ON FUNCTION check_level_up IS 'Checks if user has leveled up and creates level_up notification.';
COMMENT ON FUNCTION handle_xp_milestone IS 'Trigger function that creates xp_milestone and level_up notifications when XP milestones are reached.';
