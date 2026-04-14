-- Migrate existing admin users from old role system to new app_access_level system
-- This ensures users with role='admin' are migrated to app_access_level='administrator'

-- Migrate admin role to administrator access level
UPDATE profiles
SET app_access_level = 'administrator'
WHERE role = 'admin' 
  AND (app_access_level IS NULL OR app_access_level = 'user');

-- Migrate moderator role to manager access level (if applicable)
UPDATE profiles
SET app_access_level = 'manager'
WHERE role = 'moderator' 
  AND (app_access_level IS NULL OR app_access_level = 'user');

-- Add comment
COMMENT ON COLUMN profiles.app_access_level IS 
  'New app access level: user (default), manager, administrator. Migrated from old role system where admin->administrator, moderator->manager.';

