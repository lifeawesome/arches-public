-- Create enums for social feed
CREATE TYPE feed_post_type AS ENUM ('task_win', 'milestone', 'shoutout');
CREATE TYPE feed_visibility AS ENUM ('public', 'dream_team', 'private');
CREATE TYPE reaction_type AS ENUM ('like', 'celebrate', 'support', 'congrats');

-- Feed posts table
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type feed_post_type NOT NULL,
  task_instance_id UUID REFERENCES user_task_instances(id) ON DELETE SET NULL,
  content TEXT,
  proof_preview JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  visibility feed_visibility DEFAULT 'public'
);

-- Feed reactions table
CREATE TABLE IF NOT EXISTS feed_reactions (
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type reaction_type DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, reaction_type)
);

-- Feed comments table
CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX idx_feed_posts_type ON feed_posts(type);
CREATE INDEX idx_feed_posts_visibility ON feed_posts(visibility, created_at DESC);
CREATE INDEX idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX idx_feed_posts_task_instance_id ON feed_posts(task_instance_id) WHERE task_instance_id IS NOT NULL;
CREATE INDEX idx_feed_reactions_post_id ON feed_reactions(post_id);
CREATE INDEX idx_feed_reactions_user_id ON feed_reactions(user_id);
CREATE INDEX idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX idx_feed_comments_user_id ON feed_comments(user_id);
CREATE INDEX idx_feed_comments_created_at ON feed_comments(post_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Feed posts visibility-based access
-- Users can view public posts and their own posts
CREATE POLICY "Users can view public feed posts" ON feed_posts
  FOR SELECT USING (visibility = 'public' OR user_id = auth.uid());

CREATE POLICY "Users can insert their own feed posts" ON feed_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feed posts" ON feed_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feed posts" ON feed_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Feed reactions: Users can view all reactions, add/remove their own
CREATE POLICY "Users can view all feed reactions" ON feed_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own feed reactions" ON feed_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feed reactions" ON feed_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Feed comments: Users can view comments on visible posts, add/edit/delete their own
CREATE POLICY "Users can view comments on visible posts" ON feed_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_posts 
      WHERE feed_posts.id = feed_comments.post_id 
      AND (feed_posts.visibility = 'public' OR feed_posts.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert comments on visible posts" ON feed_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM feed_posts 
      WHERE feed_posts.id = feed_comments.post_id 
      AND (feed_posts.visibility = 'public' OR feed_posts.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own comments" ON feed_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON feed_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_feed_posts_updated_at BEFORE UPDATE ON feed_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_comments_updated_at BEFORE UPDATE ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

