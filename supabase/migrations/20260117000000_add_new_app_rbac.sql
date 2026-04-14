-- Add new RBAC columns for new app (parallel to old system)
-- Old app continues using: profiles.role, profiles.subscription_tier
-- New app uses: profiles.app_access_level, profiles.app_subscription_tier

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS app_access_level TEXT DEFAULT 'user' 
  CHECK (app_access_level IN ('user', 'manager', 'administrator'));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS app_subscription_tier TEXT DEFAULT 'explorer' 
  CHECK (app_subscription_tier IN ('explorer', 'practitioner', 'professional', 'established'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_app_access_level ON profiles(app_access_level);
CREATE INDEX IF NOT EXISTS idx_profiles_app_subscription_tier ON profiles(app_subscription_tier);

-- Comments
COMMENT ON COLUMN profiles.app_access_level IS 
  'New app access level: user (default), manager, administrator. Separate from profiles.role for old app.';
COMMENT ON COLUMN profiles.app_subscription_tier IS 
  'New app subscription tier: explorer, practitioner, professional, established. Separate from profiles.subscription_tier for old app.';

-- New app RBAC helper functions (parallel to old is_admin(), etc.)

-- Check if user has app access level
CREATE OR REPLACE FUNCTION app_has_access_level(
  user_id UUID, 
  required_level TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_level TEXT;
  level_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  -- Get user's access level
  SELECT app_access_level INTO user_level
  FROM public.profiles
  WHERE id = user_id;
  
  IF user_level IS NULL THEN
    user_level := 'user'; -- Default
  END IF;
  
  -- Define hierarchy: user=1, manager=2, administrator=3
  level_hierarchy := CASE user_level
    WHEN 'user' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'administrator' THEN 3
    ELSE 1
  END;
  
  required_hierarchy := CASE required_level
    WHEN 'user' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'administrator' THEN 3
    ELSE 1
  END;
  
  RETURN level_hierarchy >= required_hierarchy;
END;
$$;

-- Check if user is app administrator
CREATE OR REPLACE FUNCTION app_is_administrator(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id 
    AND app_access_level = 'administrator'
  );
END;
$$;

-- Check if user is app manager or administrator
CREATE OR REPLACE FUNCTION app_is_manager_or_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id 
    AND app_access_level IN ('manager', 'administrator')
  );
END;
$$;

-- Check if user has app subscription tier
CREATE OR REPLACE FUNCTION app_has_subscription_tier(
  user_id UUID,
  required_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_tier TEXT;
  tier_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  SELECT app_subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = user_id;
  
  IF user_tier IS NULL THEN
    user_tier := 'explorer'; -- Default
  END IF;
  
  -- Define hierarchy: explorer=1, practitioner=2, professional=3, established=4
  tier_hierarchy := CASE user_tier
    WHEN 'explorer' THEN 1
    WHEN 'practitioner' THEN 2
    WHEN 'professional' THEN 3
    WHEN 'established' THEN 4
    ELSE 1
  END;
  
  required_hierarchy := CASE required_tier
    WHEN 'explorer' THEN 1
    WHEN 'practitioner' THEN 2
    WHEN 'professional' THEN 3
    WHEN 'established' THEN 4
    ELSE 1
  END;
  
  RETURN tier_hierarchy >= required_hierarchy;
END;
$$;

-- Comments
COMMENT ON FUNCTION app_has_access_level IS 
  'Check if user has required access level for new app. Hierarchy: user < manager < administrator';
COMMENT ON FUNCTION app_is_administrator IS 
  'Check if user is administrator in new app';
COMMENT ON FUNCTION app_is_manager_or_admin IS 
  'Check if user is manager or administrator in new app';
COMMENT ON FUNCTION app_has_subscription_tier IS 
  'Check if user has required subscription tier for new app. Hierarchy: explorer < practitioner < professional < established';

