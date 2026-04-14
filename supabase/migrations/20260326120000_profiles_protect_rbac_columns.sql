-- Prevent non-administrators from changing app_access_level / app_subscription_tier on their own (or any) row
-- when using a normal authenticated JWT. Allows service_role, DB/superuser (no JWT role), and app administrators.

CREATE OR REPLACE FUNCTION public.profiles_prevent_privileged_column_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  IF NEW.app_access_level IS NOT DISTINCT FROM OLD.app_access_level
     AND NEW.app_subscription_tier IS NOT DISTINCT FROM OLD.app_subscription_tier THEN
    RETURN NEW;
  END IF;

  jwt_role := NULLIF(trim(both ' ' FROM COALESCE(
    current_setting('request.jwt.claim.role', true),
    ''
  )), '');

  -- Migrations, SQL editor, superuser paths often have no JWT role
  IF jwt_role IS NULL OR jwt_role = '' THEN
    RETURN NEW;
  END IF;

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.app_is_administrator(auth.uid()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Changing app_access_level or app_subscription_tier requires administrator or service privileges';
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_rbac_columns ON public.profiles;

CREATE TRIGGER profiles_protect_rbac_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_privileged_column_self_update();

COMMENT ON FUNCTION public.profiles_prevent_privileged_column_self_update() IS
  'Blocks UPDATE of app_access_level/app_subscription_tier unless JWT is service_role, user is app administrator, or no JWT role (trusted server paths).';
