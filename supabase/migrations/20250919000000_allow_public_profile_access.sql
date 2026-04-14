-- Allow users to view other users' profiles for messaging and browsing
-- This is needed for the member search functionality in the messaging system

-- Add policy to allow authenticated users to view other users' profiles
CREATE POLICY "Users can view other users' public profiles" ON profiles
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );
