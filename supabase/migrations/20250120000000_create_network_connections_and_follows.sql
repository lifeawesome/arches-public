-- Create network_connections table for bidirectional connections
-- "Add to Network" creates a connection between two members
CREATE TABLE IF NOT EXISTS network_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure a user can only have one connection record with another user
  -- We'll store the connection with the lower user_id first to avoid duplicates
  UNIQUE(user_id, connected_user_id),
  
  -- Prevent self-connections
  CONSTRAINT network_connections_no_self_connection CHECK (user_id != connected_user_id)
);

-- Create member_follows table for one-way follows
-- "Follow Member" allows users to follow other members without requiring acceptance
CREATE TABLE IF NOT EXISTS member_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure a user can only follow another user once
  UNIQUE(follower_id, following_id),
  
  -- Prevent self-follows
  CONSTRAINT member_follows_no_self_follow CHECK (follower_id != following_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_network_connections_user_id ON network_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_connected_user_id ON network_connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_status ON network_connections(status);
CREATE INDEX IF NOT EXISTS idx_network_connections_created_at ON network_connections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_follows_follower_id ON member_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_member_follows_following_id ON member_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_member_follows_created_at ON member_follows(created_at DESC);

-- Enable Row Level Security
ALTER TABLE network_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for network_connections
-- Users can view their own connections (both as initiator and recipient)
CREATE POLICY "Users can view their own connections" ON network_connections
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = connected_user_id
  );

-- Users can create connection requests
CREATE POLICY "Users can create connection requests" ON network_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection requests (accept/decline)
CREATE POLICY "Users can update their own connections" ON network_connections
  FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = connected_user_id
  );

-- Users can delete their own connection requests
CREATE POLICY "Users can delete their own connections" ON network_connections
  FOR DELETE USING (
    auth.uid() = user_id OR auth.uid() = connected_user_id
  );

-- RLS Policies for member_follows
-- Users can view follows where they are the follower or being followed
CREATE POLICY "Users can view relevant follows" ON member_follows
  FOR SELECT USING (
    auth.uid() = follower_id OR auth.uid() = following_id
  );

-- Users can create follows
CREATE POLICY "Users can create follows" ON member_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follows
CREATE POLICY "Users can delete their own follows" ON member_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Add comments for documentation
COMMENT ON TABLE network_connections IS 'Bidirectional connections between members (Add to Network feature)';
COMMENT ON COLUMN network_connections.user_id IS 'The user who initiated the connection';
COMMENT ON COLUMN network_connections.connected_user_id IS 'The user being connected to';
COMMENT ON COLUMN network_connections.status IS 'Connection status: pending, accepted, or blocked';

COMMENT ON TABLE member_follows IS 'One-way follows between members (Follow Member feature)';
COMMENT ON COLUMN member_follows.follower_id IS 'The user who is following';
COMMENT ON COLUMN member_follows.following_id IS 'The user being followed';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_network_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER network_connections_updated_at
  BEFORE UPDATE ON network_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_network_connections_updated_at();











