-- Add user roles system for RBAC
-- Roles: admin, moderator, member (default)

-- Add role column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member'));

-- Create index for efficient role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add comment for documentation
COMMENT ON COLUMN profiles.role IS 'User role for access control: admin, moderator, or member (default)';

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is admin or moderator
CREATE OR REPLACE FUNCTION is_admin_or_moderator(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for role management
-- Note: We'll handle role updates through admin functions with SECURITY DEFINER
-- to avoid infinite recursion in policies. Regular users can update their own
-- profile through the existing "Users can update their own profile" policy,
-- but the role column will be protected by a trigger that prevents non-admins
-- from changing it.

-- Create a trigger function to prevent non-admins from changing roles
CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
DECLARE
  is_admin_user BOOLEAN;
  current_user_id UUID;
BEGIN
  -- Get current authenticated user ID
  current_user_id := auth.uid();
  
  -- Allow role changes if there's no authenticated user (during migrations/seeding)
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Allow role changes if the user making the change is an admin
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = current_user_id AND role = 'admin'
  ) INTO is_admin_user;
  
  -- If role is being changed and user is not an admin, prevent it
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_admin_user THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce role change restrictions
DROP TRIGGER IF EXISTS enforce_role_change_restrictions ON profiles;
CREATE TRIGGER enforce_role_change_restrictions
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_change();

-- Add comments
COMMENT ON FUNCTION is_admin IS 'Check if a user has admin role';
COMMENT ON FUNCTION is_admin_or_moderator IS 'Check if a user has admin or moderator role';

