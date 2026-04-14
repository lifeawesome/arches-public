-- Circle reports: users can report content or comments; moderators/owners resolve

DO $$ BEGIN
  CREATE TYPE circle_report_status AS ENUM ('pending', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS circle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_content_id UUID REFERENCES circle_content(id) ON DELETE CASCADE,
  reported_comment_id UUID REFERENCES circle_comments(id) ON DELETE CASCADE,
  reason_text TEXT,
  status circle_report_status NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circle_reports_target_check CHECK (
    (reported_content_id IS NOT NULL) OR (reported_comment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_circle_reports_circle_status ON circle_reports(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_reports_content ON circle_reports(reported_content_id) WHERE reported_content_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circle_reports_comment ON circle_reports(reported_comment_id) WHERE reported_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circle_reports_created ON circle_reports(created_at DESC);

COMMENT ON TABLE circle_reports IS 'User reports on circle content or comments; moderators/owners can resolve or dismiss.';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE circle_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can see their own reports
CREATE POLICY "Users can view own reports" ON circle_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Moderators and owners can view all reports for their circle
CREATE POLICY "Moderators can view all reports in circle" ON circle_reports
  FOR SELECT
  TO authenticated
  USING (is_circle_moderator(circle_id));

-- Authenticated members (non-blocked) can insert reports; enforce in API that reporter is member and not blocked
CREATE POLICY "Members can create reports" ON circle_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND (reported_content_id IS NOT NULL OR reported_comment_id IS NOT NULL)
  );

-- Only moderators/owners can update (resolve/dismiss)
CREATE POLICY "Moderators can update reports in circle" ON circle_reports
  FOR UPDATE
  TO authenticated
  USING (is_circle_moderator(circle_id))
  WITH CHECK (is_circle_moderator(circle_id));
