-- Atomic view_count increment for circle_content (server-side only via service role).
-- Next.js API verifies access with the user session, then calls this with the service role.

CREATE OR REPLACE FUNCTION public.increment_circle_content_view_count(
  p_circle_id uuid,
  p_content_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated int;
BEGIN
  UPDATE circle_content
  SET
    view_count = COALESCE(view_count, 0) + 1,
    updated_at = now()
  WHERE id = p_content_id
    AND circle_id = p_circle_id
    AND approval_status = 'approved'
    AND is_published = TRUE
    AND (is_deleted IS NOT TRUE OR is_deleted IS NULL);

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

COMMENT ON FUNCTION public.increment_circle_content_view_count(uuid, uuid) IS
  'Increments view_count for approved published content. Intended for service_role only; callers must enforce access control.';

REVOKE ALL ON FUNCTION public.increment_circle_content_view_count(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_circle_content_view_count(uuid, uuid) TO service_role;
