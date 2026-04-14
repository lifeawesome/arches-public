-- Issue #133: structured report reasons on circle_reports; platform_reports for circle-level moderation

-- ---------------------------------------------------------------------------
-- Shared reason enum (circle + platform reports)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM (
    'spam',
    'harassment',
    'inappropriate_content',
    'copyright',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- circle_reports: reason + description (keep reason_text for legacy)
-- ---------------------------------------------------------------------------
ALTER TABLE circle_reports
  ADD COLUMN IF NOT EXISTS reason report_reason NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE circle_reports
SET description = reason_text
WHERE description IS NULL AND reason_text IS NOT NULL AND btrim(reason_text) <> '';

COMMENT ON COLUMN circle_reports.reason IS 'Structured report category; default other for legacy rows.';
COMMENT ON COLUMN circle_reports.description IS 'Optional extra detail from the reporter.';

-- ---------------------------------------------------------------------------
-- platform_reports (issue #133); v1 API uses report_type = circle only
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE platform_report_type AS ENUM ('circle', 'post', 'comment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE platform_report_status AS ENUM ('pending', 'reviewed', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS platform_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type platform_report_type NOT NULL,
  reported_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  description TEXT,
  status platform_report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- reported_id is polymorphic; validated in application code.

CREATE INDEX IF NOT EXISTS idx_platform_reports_status_created
  ON platform_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_reports_reporter
  ON platform_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_platform_reports_type_reported
  ON platform_reports(report_type, reported_id);

COMMENT ON TABLE platform_reports IS 'Platform-level moderation reports; v1 uses report_type=circle (reported_id = circles.id).';

ALTER TABLE platform_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_reports_select_own_or_admin"
  ON platform_reports FOR SELECT TO authenticated
  USING (
    reporter_id = (SELECT auth.uid())
    OR public.app_is_administrator((SELECT auth.uid()))
  );

CREATE POLICY "platform_reports_insert_own"
  ON platform_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));

CREATE POLICY "platform_reports_update_admin"
  ON platform_reports FOR UPDATE TO authenticated
  USING (public.app_is_administrator((SELECT auth.uid())))
  WITH CHECK (public.app_is_administrator((SELECT auth.uid())));

-- ---------------------------------------------------------------------------
-- In-app notification when a moderation report is closed (optional / issue)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE notification_event_type ADD VALUE 'moderation_report_reviewed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
