-- Issue #137: Run scheduled post publishing via pg_cron (Supabase Database > Extensions > pg_cron).
-- Mirrors resolveInitialApprovalStatus (access-control.ts) for the author at publish time.
-- If pg_cron is not installed, the function still exists for manual SELECT or HTTP cron.

-- ============================================================================
-- 1) Approval status for a row about to leave "scheduled" (same rules as TS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initial_approval_status_when_scheduled_publishes(
  p_circle_id UUID,
  p_author_id UUID
)
RETURNS circle_content_approval_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expert UUID;
  v_requires BOOLEAN;
BEGIN
  SELECT expert_id INTO v_expert FROM circles WHERE id = p_circle_id;
  IF NOT FOUND THEN
    RETURN 'pending';
  END IF;
  IF v_expert = p_author_id THEN
    RETURN 'approved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM circle_memberships
    WHERE circle_id = p_circle_id
      AND user_id = p_author_id
      AND status = 'active'
      AND role = 'moderator'
  ) THEN
    RETURN 'approved';
  END IF;

  SELECT COALESCE((settings->>'requires_approval')::boolean, false)
  INTO v_requires
  FROM circles
  WHERE id = p_circle_id;

  IF v_requires THEN
    RETURN 'pending';
  END IF;

  RETURN 'approved';
END;
$$;

COMMENT ON FUNCTION public.initial_approval_status_when_scheduled_publishes(UUID, UUID) IS
  'Approval state when a scheduled post goes live (owner/mod approved; else requires_approval).';

-- ============================================================================
-- 2) Job: publish due scheduled posts (batch)
-- ============================================================================

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
BEGIN
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

  RETURN v_processed;
END;
$$;

COMMENT ON FUNCTION public.process_due_scheduled_circle_posts_job() IS
  'Publishes due scheduled circle posts; intended for pg_cron every minute.';

GRANT EXECUTE ON FUNCTION public.process_due_scheduled_circle_posts_job() TO postgres;
GRANT EXECUTE ON FUNCTION public.process_due_scheduled_circle_posts_job() TO service_role;

-- ============================================================================
-- 3) Schedule with pg_cron when the extension exists (Supabase: enable in Dashboard)
-- ============================================================================

DO $sched$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('publish-scheduled-circle-posts');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'publish-scheduled-circle-posts',
      '* * * * *',
      $$SELECT public.process_due_scheduled_circle_posts_job()$$
    );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron extension not loaded; enable Database > Extensions > pg_cron, then run: SELECT cron.schedule(''publish-scheduled-circle-posts'', ''* * * * *'', $$SELECT public.process_due_scheduled_circle_posts_job()$$);';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not register pg_cron job: %', SQLERRM;
END;
$sched$;
