-- Create marketing_preferences table
CREATE TABLE IF NOT EXISTS marketing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emailoctopus_contact_id TEXT, -- EmailOctopus contact ID
  
  -- Newsletter subscriptions
  newsletter_subscribed BOOLEAN DEFAULT true,
  product_updates_subscribed BOOLEAN DEFAULT true,
  event_invitations_subscribed BOOLEAN DEFAULT true,
  success_stories_subscribed BOOLEAN DEFAULT true,
  partner_offers_subscribed BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE marketing_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own marketing preferences" ON marketing_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own marketing preferences" ON marketing_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own marketing preferences" ON marketing_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_marketing_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_marketing_preferences_updated_at
  BEFORE UPDATE ON marketing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_preferences_updated_at();

-- Create function to initialize marketing preferences for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_marketing_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default marketing preferences for new user
  INSERT INTO public.marketing_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create marketing preferences on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_marketing_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_marketing_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_marketing_preferences();

-- Add comments for documentation
COMMENT ON TABLE marketing_preferences IS 'User marketing email preferences and EmailOctopus integration';
COMMENT ON COLUMN marketing_preferences.user_id IS 'References auth.users.id';
COMMENT ON COLUMN marketing_preferences.emailoctopus_contact_id IS 'EmailOctopus contact ID for API operations';
COMMENT ON COLUMN marketing_preferences.newsletter_subscribed IS 'Weekly newsletter subscription status';
COMMENT ON COLUMN marketing_preferences.product_updates_subscribed IS 'Product updates subscription status';
COMMENT ON COLUMN marketing_preferences.event_invitations_subscribed IS 'Event invitations subscription status';
COMMENT ON COLUMN marketing_preferences.success_stories_subscribed IS 'Success stories subscription status';
COMMENT ON COLUMN marketing_preferences.partner_offers_subscribed IS 'Partner offers subscription status';

