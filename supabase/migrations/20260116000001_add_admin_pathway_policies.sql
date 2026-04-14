-- Add admin policies for pathway content management
-- Admins need full CRUD access to pathways, levels, tasks, and related content

-- Pathways: Admins can manage all pathways
CREATE POLICY "Admins can manage pathways" ON pathways
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Admins can also view inactive pathways (for editing)
CREATE POLICY "Admins can view all pathways" ON pathways
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Levels: Admins can manage all levels
CREATE POLICY "Admins can manage levels" ON levels
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Tasks: Admins can manage all tasks
CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Task steps: Admins can manage all task steps
CREATE POLICY "Admins can manage task steps" ON task_steps
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Task proof requirements: Admins can manage all proof requirements
CREATE POLICY "Admins can manage task proof requirements" ON task_proof_requirements
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Unlock rules: Admins can manage all unlock rules
CREATE POLICY "Admins can manage unlock rules" ON unlock_rules
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Achievements: Admins can manage all achievements
CREATE POLICY "Admins can manage achievements" ON achievements
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Comments for documentation
COMMENT ON POLICY "Admins can manage pathways" ON pathways IS 
  'Allows administrators to create, update, and delete pathways';
COMMENT ON POLICY "Admins can view all pathways" ON pathways IS 
  'Allows administrators to view inactive pathways for editing';

