-- Circle Polls (content_type = 'poll')
-- Adds polls to circle_content via circle_polls + circle_poll_votes + aggregated circle_poll_results

-- ============================================================================
-- ENUM UPDATE
-- ============================================================================

DO $$
BEGIN
  ALTER TYPE circle_content_type ADD VALUE 'poll';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES circle_content(id) ON DELETE CASCADE,

  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT circle_polls_question_not_empty CHECK (length(trim(question)) > 0),
  CONSTRAINT circle_polls_options_is_array CHECK (jsonb_typeof(options) = 'array'),
  CONSTRAINT circle_polls_options_count_valid CHECK (jsonb_array_length(options) >= 2 AND jsonb_array_length(options) <= 10),
  CONSTRAINT circle_polls_content_unique UNIQUE (content_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_polls_circle_id ON circle_polls(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_polls_content_id ON circle_polls(content_id);

CREATE TABLE IF NOT EXISTS circle_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES circle_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT circle_poll_votes_option_index_non_negative CHECK (option_index >= 0),
  CONSTRAINT circle_poll_votes_one_vote_per_user UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_poll_votes_poll_id ON circle_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_circle_poll_votes_user_id ON circle_poll_votes(user_id);

-- Aggregated results table (published to realtime)
CREATE TABLE IF NOT EXISTS circle_poll_results (
  poll_id UUID NOT NULL REFERENCES circle_polls(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (poll_id, option_index),
  CONSTRAINT circle_poll_results_option_index_non_negative CHECK (option_index >= 0),
  CONSTRAINT circle_poll_results_vote_count_non_negative CHECK (vote_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_circle_poll_results_poll_id ON circle_poll_results(poll_id);

-- ============================================================================
-- TRIGGERS / FUNCTIONS
-- ============================================================================

-- Keep updated_at consistent with circles system
DO $$
BEGIN
  CREATE TRIGGER trigger_update_circle_polls_updated_at
    BEFORE UPDATE ON circle_polls
    FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER trigger_update_circle_poll_votes_updated_at
    BEFORE UPDATE ON circle_poll_votes
    FOR EACH ROW EXECUTE FUNCTION update_circles_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Validate vote option_index is within poll options array
CREATE OR REPLACE FUNCTION validate_circle_poll_vote_option_index()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_option_count INTEGER;
BEGIN
  SELECT jsonb_array_length(options) INTO v_option_count
  FROM circle_polls
  WHERE id = NEW.poll_id;

  IF v_option_count IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF NEW.option_index < 0 OR NEW.option_index >= v_option_count THEN
    RAISE EXCEPTION 'Invalid option_index % for poll %', NEW.option_index, NEW.poll_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_circle_poll_vote_option_index ON circle_poll_votes;
CREATE TRIGGER trigger_validate_circle_poll_vote_option_index
  BEFORE INSERT OR UPDATE ON circle_poll_votes
  FOR EACH ROW EXECUTE FUNCTION validate_circle_poll_vote_option_index();

-- Initialize results rows when a poll is created
CREATE OR REPLACE FUNCTION init_circle_poll_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i INTEGER;
  v_option_count INTEGER;
BEGIN
  v_option_count := jsonb_array_length(NEW.options);
  i := 0;
  WHILE i < v_option_count LOOP
    INSERT INTO circle_poll_results (poll_id, option_index, vote_count)
    VALUES (NEW.id, i, 0)
    ON CONFLICT (poll_id, option_index) DO NOTHING;
    i := i + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_init_circle_poll_results ON circle_polls;
CREATE TRIGGER trigger_init_circle_poll_results
  AFTER INSERT ON circle_polls
  FOR EACH ROW EXECUTE FUNCTION init_circle_poll_results();

-- Maintain aggregated results when votes change
CREATE OR REPLACE FUNCTION apply_circle_poll_vote_to_results()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO circle_poll_results (poll_id, option_index, vote_count, updated_at)
    VALUES (NEW.poll_id, NEW.option_index, 1, NOW())
    ON CONFLICT (poll_id, option_index)
      DO UPDATE SET vote_count = circle_poll_results.vote_count + 1, updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circle_poll_results
      SET vote_count = GREATEST(0, vote_count - 1),
          updated_at = NOW()
    WHERE poll_id = OLD.poll_id AND option_index = OLD.option_index;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.option_index = NEW.option_index THEN
      RETURN NEW;
    END IF;

    UPDATE circle_poll_results
      SET vote_count = GREATEST(0, vote_count - 1),
          updated_at = NOW()
    WHERE poll_id = OLD.poll_id AND option_index = OLD.option_index;

    INSERT INTO circle_poll_results (poll_id, option_index, vote_count, updated_at)
    VALUES (NEW.poll_id, NEW.option_index, 1, NOW())
    ON CONFLICT (poll_id, option_index)
      DO UPDATE SET vote_count = circle_poll_results.vote_count + 1, updated_at = NOW();

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_circle_poll_vote_to_results ON circle_poll_votes;
CREATE TRIGGER trigger_apply_circle_poll_vote_to_results
  AFTER INSERT OR UPDATE OR DELETE ON circle_poll_votes
  FOR EACH ROW EXECUTE FUNCTION apply_circle_poll_vote_to_results();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE circle_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_poll_results ENABLE ROW LEVEL SECURITY;

-- Polls: view if you can view the underlying content (member access or free preview)
DROP POLICY IF EXISTS "Anyone can view free published polls" ON circle_polls;
CREATE POLICY "Anyone can view free published polls" ON circle_polls
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM circle_content cc
      WHERE cc.id = circle_polls.content_id
        AND cc.is_published = TRUE
        AND cc.is_free = TRUE
    )
  );

DROP POLICY IF EXISTS "Circle members can view published polls" ON circle_polls;
CREATE POLICY "Circle members can view published polls" ON circle_polls
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM circle_content cc
      WHERE cc.id = circle_polls.content_id
        AND cc.is_published = TRUE
        AND (can_access_circle(circle_polls.circle_id) OR cc.is_free = TRUE)
    )
  );

-- Polls: create allowed to circle owners or members where posting is allowed (mirrors circle_content policy intent)
DROP POLICY IF EXISTS "Circle owners can create polls" ON circle_polls;
CREATE POLICY "Circle owners can create polls" ON circle_polls
  FOR INSERT
  TO authenticated
  WITH CHECK (is_circle_owner(circle_id));

DROP POLICY IF EXISTS "Circle members can create polls if allowed" ON circle_polls;
CREATE POLICY "Circle members can create polls if allowed" ON circle_polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_circle_member(circle_id)
    AND EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_polls.circle_id
        AND (c.settings->>'allow_member_posts')::boolean = TRUE
    )
  );

-- Polls are immutable in app; no UPDATE/DELETE policies provided for clients.

-- Votes: users can vote in polls they can access; one row per (poll,user) enforced by unique constraint.
DROP POLICY IF EXISTS "Users can vote in accessible polls" ON circle_poll_votes;
CREATE POLICY "Users can vote in accessible polls" ON circle_poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_polls p
      JOIN circle_content cc ON cc.id = p.content_id
      WHERE p.id = circle_poll_votes.poll_id
        AND cc.is_published = TRUE
        AND (can_access_circle(p.circle_id) OR cc.is_free = TRUE)
    )
  );

DROP POLICY IF EXISTS "Users can change their vote in accessible polls" ON circle_poll_votes;
CREATE POLICY "Users can change their vote in accessible polls" ON circle_poll_votes
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_polls p
      JOIN circle_content cc ON cc.id = p.content_id
      WHERE p.id = circle_poll_votes.poll_id
        AND cc.is_published = TRUE
        AND (can_access_circle(p.circle_id) OR cc.is_free = TRUE)
    )
  )
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their vote in accessible polls" ON circle_poll_votes;
CREATE POLICY "Users can remove their vote in accessible polls" ON circle_poll_votes
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_polls p
      JOIN circle_content cc ON cc.id = p.content_id
      WHERE p.id = circle_poll_votes.poll_id
        AND cc.is_published = TRUE
        AND (can_access_circle(p.circle_id) OR cc.is_free = TRUE)
    )
  );

-- Votes: allow a user to read only their own vote (privacy-preserving)
DROP POLICY IF EXISTS "Users can view their own vote" ON circle_poll_votes;
CREATE POLICY "Users can view their own vote" ON circle_poll_votes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_polls p
      JOIN circle_content cc ON cc.id = p.content_id
      WHERE p.id = circle_poll_votes.poll_id
        AND cc.is_published = TRUE
        AND (can_access_circle(p.circle_id) OR cc.is_free = TRUE)
    )
  );

-- Results: readable where poll content is readable (free preview or member access)
DROP POLICY IF EXISTS "Anyone can view free published poll results" ON circle_poll_results;
CREATE POLICY "Anyone can view free published poll results" ON circle_poll_results
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM circle_polls p
      JOIN circle_content cc ON cc.id = p.content_id
      WHERE p.id = circle_poll_results.poll_id
        AND cc.is_published = TRUE
        AND cc.is_free = TRUE
    )
  );

DROP POLICY IF EXISTS "Circle members can view published poll results" ON circle_poll_results;
CREATE POLICY "Circle members can view published poll results" ON circle_poll_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM circle_polls p
      JOIN circle_content cc ON cc.id = p.content_id
      WHERE p.id = circle_poll_results.poll_id
        AND cc.is_published = TRUE
        AND (can_access_circle(p.circle_id) OR cc.is_free = TRUE)
    )
  );

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER TABLE circle_poll_results REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE circle_poll_results;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

