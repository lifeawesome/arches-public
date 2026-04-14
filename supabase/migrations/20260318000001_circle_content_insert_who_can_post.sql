-- Extend circle_content INSERT RLS to respect settings.who_can_post
-- while keeping full backwards compatibility with settings.allow_member_posts.
--
-- Permission matrix for content creation:
--   Owner:        always allowed (kept in separate "Circle owners can create content" policy).
--   Moderator:    always allowed when who_can_post = 'moderators_only' OR 'all_members'.
--   Contributor:  allowed when who_can_post = 'all_members' OR (fallback) allow_member_posts = true.
--   Member:       allowed when who_can_post = 'all_members' OR (fallback) allow_member_posts = true.
--
-- The existing "Circle owners can create content" policy stays unchanged.
-- We replace only "Circle members can create content if allowed".

DROP POLICY IF EXISTS "Circle members can create content if allowed" ON circle_content;

CREATE POLICY "Circle members can create content if allowed" ON circle_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_circle_member(circle_id)
    AND EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_content.circle_id
        AND (
          -- New: who_can_post = 'all_members' allows any active member
          (c.settings->>'who_can_post') = 'all_members'
          -- Legacy: allow_member_posts = true also allows any active member
          OR (c.settings->>'allow_member_posts')::boolean = TRUE
        )
    )
  );

-- Separate policy for moderator-only posting (when who_can_post = 'moderators_only')
-- Moderators are already members, so is_circle_moderator() covers both moderator + owner.
-- The owner is handled by the existing "Circle owners can create content" policy.
DROP POLICY IF EXISTS "Moderators can create content if required" ON circle_content;

CREATE POLICY "Moderators can create content if required" ON circle_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_circle_moderator(circle_id)
    AND EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_content.circle_id
        AND (c.settings->>'who_can_post') = 'moderators_only'
    )
  );

COMMENT ON POLICY "Circle members can create content if allowed" ON circle_content IS
  'Members (and contributors) may create content when who_can_post = all_members OR allow_member_posts = true. Backwards-compatible.';

COMMENT ON POLICY "Moderators can create content if required" ON circle_content IS
  'Moderators (and owners via separate policy) may create content when who_can_post = moderators_only.';
