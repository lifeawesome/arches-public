-- Security/reliability hardening for scheduled post publisher:
-- - prevent overlapping executions with advisory lock
-- - keep existing semantics otherwise

CREATE OR REPLACE FUNCTION public.process_due_scheduled_circle_posts_job()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_approval circle_content_approval_status;
  v_published BOOLEAN;
  v_processed INTEGER := 0;
  v_rowcount INTEGER;
  v_has_lock BOOLEAN := FALSE;
BEGIN
  -- Single-run guard across concurrent cron workers.
  v_has_lock := pg_try_advisory_lock(715421389001);
  IF NOT v_has_lock THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id, circle_id, author_id
    FROM circle_content
    WHERE publication_status = 'scheduled'
      AND content_type = 'post'
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= now()
    ORDER BY scheduled_for ASC
    LIMIT 100
  LOOP
    v_approval := initial_approval_status_when_scheduled_publishes(r.circle_id, r.author_id);
    v_published := (v_approval = 'approved');

    UPDATE circle_content
    SET
      publication_status = 'published',
      scheduled_for = NULL,
      approval_status = v_approval,
      is_published = v_published,
      published_at = CASE WHEN v_published THEN now() ELSE NULL END,
      updated_at = now()
    WHERE id = r.id
      AND publication_status = 'scheduled';

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      CONTINUE;
    END IF;

    v_processed := v_processed + 1;

    IF v_published THEN
      PERFORM notify_circle_members_of_new_post(r.id);
    END IF;
  END LOOP;

  PERFORM pg_advisory_unlock(715421389001);
  RETURN v_processed;
EXCEPTION
  WHEN OTHERS THEN
    IF v_has_lock THEN
      PERFORM pg_advisory_unlock(715421389001);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_scheduled_circle_posts_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_due_scheduled_circle_posts_job() FROM anon;
REVOKE ALL ON FUNCTION public.process_due_scheduled_circle_posts_job() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_scheduled_circle_posts_job() TO postgres;
GRANT EXECUTE ON FUNCTION public.process_due_scheduled_circle_posts_job() TO service_role;
