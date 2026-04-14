-- Security: SECURITY DEFINER functions must not be callable by anon/authenticated via PostgREST.
-- Default PostgreSQL behavior can grant EXECUTE to PUBLIC for new functions.

REVOKE ALL ON FUNCTION public.process_due_scheduled_circle_posts_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_due_scheduled_circle_posts_job() FROM anon;
REVOKE ALL ON FUNCTION public.process_due_scheduled_circle_posts_job() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.process_due_scheduled_circle_posts_job() TO postgres;
GRANT EXECUTE ON FUNCTION public.process_due_scheduled_circle_posts_job() TO service_role;

REVOKE ALL ON FUNCTION public.initial_approval_status_when_scheduled_publishes(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initial_approval_status_when_scheduled_publishes(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.initial_approval_status_when_scheduled_publishes(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.initial_approval_status_when_scheduled_publishes(uuid, uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.initial_approval_status_when_scheduled_publishes(uuid, uuid) TO service_role;
