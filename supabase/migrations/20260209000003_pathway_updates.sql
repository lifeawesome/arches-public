-- Pathway Updates
-- Updates for pathway-related functionality: RBAC policies, task_type enum conversion, and user_pathways DELETE policy

-- Update pathway-related admin policies to use new app RBAC
-- This allows the new app to use app_is_administrator() while old app policies remain untouched

-- Levels
DROP POLICY IF EXISTS "Admins can manage levels" ON levels;

CREATE POLICY "App administrators can manage levels" ON levels
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "Legacy admins can manage levels" ON levels
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Tasks
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;

CREATE POLICY "App administrators can manage tasks" ON tasks
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "Legacy admins can manage tasks" ON tasks
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Task steps
DROP POLICY IF EXISTS "Admins can manage task steps" ON task_steps;

CREATE POLICY "App administrators can manage task steps" ON task_steps
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "Legacy admins can manage task steps" ON task_steps
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Task proof requirements
DROP POLICY IF EXISTS "Admins can manage task proof requirements" ON task_proof_requirements;

CREATE POLICY "App administrators can manage task proof requirements" ON task_proof_requirements
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "Legacy admins can manage task proof requirements" ON task_proof_requirements
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Unlock rules
DROP POLICY IF EXISTS "Admins can manage unlock rules" ON unlock_rules;

CREATE POLICY "App administrators can manage unlock rules" ON unlock_rules
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "Legacy admins can manage unlock rules" ON unlock_rules
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Achievements
DROP POLICY IF EXISTS "Admins can manage achievements" ON achievements;

CREATE POLICY "App administrators can manage achievements" ON achievements
  FOR ALL
  TO authenticated
  USING (app_is_administrator(auth.uid()))
  WITH CHECK (app_is_administrator(auth.uid()));

CREATE POLICY "Legacy admins can manage achievements" ON achievements
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Update task_type column from enum to TEXT to support all task type slugs
-- The enum only had 6 values ('create', 'refine', 'publish', 'practice', 'review', 'connect')
-- but the code uses 12 different task type slugs

-- Step 1: Convert enum column to TEXT and map old enum values to new slugs
-- Map: create → create-content, refine → refine-content, publish → publish-content,
--      practice → practice-skill, review → review-work, connect → connect-with
ALTER TABLE tasks 
  ALTER COLUMN task_type TYPE TEXT USING CASE task_type::TEXT
    WHEN 'create' THEN 'create-content'
    WHEN 'refine' THEN 'refine-content'
    WHEN 'publish' THEN 'publish-content'
    WHEN 'practice' THEN 'practice-skill'
    WHEN 'review' THEN 'review-work'
    WHEN 'connect' THEN 'connect-with'
    ELSE task_type::TEXT
  END;

-- Step 2: Drop the old enum type if it's not used elsewhere
-- Note: We check if any other columns use this enum type before dropping
DO $$
DECLARE
  enum_used_elsewhere BOOLEAN;
BEGIN
  -- Check if task_type enum is used by any other columns
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns c
    JOIN pg_type t ON c.udt_name = t.typname
    WHERE t.typname = 'task_type'
    AND c.table_name != 'tasks'
  ) INTO enum_used_elsewhere;
  
  -- Only drop if not used elsewhere
  IF NOT enum_used_elsewhere THEN
    DROP TYPE IF EXISTS task_type;
  END IF;
END $$;

-- Step 3: Add CHECK constraint to validate task type slugs
-- This ensures data integrity while allowing all valid task type slugs
ALTER TABLE tasks
  ADD CONSTRAINT tasks_task_type_check CHECK (
    task_type IN (
      'read-text',
      'watch-video',
      'take-quiz',
      'follow-guide',
      'scavenger-hunt',
      'read-quote',
      'create-content',
      'refine-content',
      'publish-content',
      'practice-skill',
      'review-work',
      'connect-with'
    )
  );

-- Add DELETE policy for user_pathways to allow users to unenroll from pathways
CREATE POLICY "Users can delete their own pathways" ON user_pathways
  FOR DELETE USING (auth.uid() = user_id);

-- Comments
COMMENT ON POLICY "App administrators can manage levels" ON levels IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage levels';
COMMENT ON POLICY "Legacy admins can manage levels" ON levels IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage levels for backward compatibility';
COMMENT ON POLICY "App administrators can manage tasks" ON tasks IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage tasks';
COMMENT ON POLICY "Legacy admins can manage tasks" ON tasks IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage tasks for backward compatibility';
COMMENT ON POLICY "App administrators can manage task steps" ON task_steps IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage task steps';
COMMENT ON POLICY "Legacy admins can manage task steps" ON task_steps IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage task steps for backward compatibility';
COMMENT ON POLICY "App administrators can manage task proof requirements" ON task_proof_requirements IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage task proof requirements';
COMMENT ON POLICY "Legacy admins can manage task proof requirements" ON task_proof_requirements IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage task proof requirements for backward compatibility';
COMMENT ON POLICY "App administrators can manage unlock rules" ON unlock_rules IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage unlock rules';
COMMENT ON POLICY "Legacy admins can manage unlock rules" ON unlock_rules IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage unlock rules for backward compatibility';
COMMENT ON POLICY "App administrators can manage achievements" ON achievements IS 
  'New app RBAC: Allows users with app_access_level=administrator to manage achievements';
COMMENT ON POLICY "Legacy admins can manage achievements" ON achievements IS 
  'Legacy RBAC: Allows users with role=admin (old app) to manage achievements for backward compatibility';
COMMENT ON COLUMN tasks.task_type IS 
  'Task type slug. Valid values: read-text, watch-video, take-quiz, follow-guide, scavenger-hunt, read-quote, create-content, refine-content, publish-content, practice-skill, review-work, connect-with';
COMMENT ON POLICY "Users can delete their own pathways" ON user_pathways IS 
  'Allows users to delete (unenroll from) their own pathway enrollments';
