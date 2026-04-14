-- Circle Search Analytics
-- Stores search queries and optional click-through events for tuning ranking and UX.

CREATE TABLE IF NOT EXISTS circle_search_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INTEGER,
  clicked_circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_search_events_created_at
  ON circle_search_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circle_search_events_user_id
  ON circle_search_events(user_id);

CREATE INDEX IF NOT EXISTS idx_circle_search_events_clicked_circle_id
  ON circle_search_events(clicked_circle_id);

ALTER TABLE circle_search_events ENABLE ROW LEVEL SECURITY;

-- Allow inserts for both anon + authenticated (public directory search).
-- user_id is optional; when present, it must match auth.uid().
DROP POLICY IF EXISTS "Anyone can insert circle search events" ON circle_search_events;
CREATE POLICY "Anyone can insert circle search events" ON circle_search_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Users can read only their own events (optional; useful for debugging).
DROP POLICY IF EXISTS "Users can view own circle search events" ON circle_search_events;
CREATE POLICY "Users can view own circle search events" ON circle_search_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE circle_search_events IS 'Analytics events for Circle search queries and click-through.';

