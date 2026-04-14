import { SupabaseClient } from "@supabase/supabase-js";
import { User } from "@supabase/supabase-js";

interface LinkedInUserData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  linkedin_id?: string;
  provider?: string;
  last_sign_in?: string;
}

export async function handleLinkedInUserData(
  supabase: SupabaseClient,
  user: User
): Promise<void> {
  try {
    // Extract LinkedIn user data from user metadata
    const linkedinData: LinkedInUserData = {
      id: user.id,
      full_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        `${user.user_metadata?.given_name || ""} ${user.user_metadata?.family_name || ""}`.trim() ||
        null,
      avatar_url:
        user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      email: user?.email || null,
      linkedin_id: user.user_metadata?.sub || null,
      provider: "linkedin",
      last_sign_in: new Date().toISOString(),
    };

    // Check if user already exists in our users table
    const { data: existingUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (userError && userError.code === "PGRST116") {
      // User doesn't exist, create new record with available fields
      const insertData: unknown = {
        id: linkedinData.id,
        full_name: linkedinData.full_name,
        avatar_url: linkedinData.avatar_url,
      };

      // Add additional fields if they exist in your table schema
      // You can uncomment these lines after adding the columns to your users table
      // insertData.linkedin_id = linkedinData.linkedin_id;
      // insertData.provider = linkedinData.provider;
      // insertData.last_sign_in = linkedinData.last_sign_in;
      // insertData.email_verified = user.user_metadata?.email_verified || false;
      // insertData.given_name = user.user_metadata?.given_name;
      // insertData.family_name = user.user_metadata?.family_name;
      // insertData.locale = user.user_metadata?.locale;

      const { error: insertError } = await supabase
        .from("users")
        .insert(insertData);

      if (insertError) {
        console.error("Error creating user record:", insertError);
        throw insertError;
      }

      console.log("Created new user record for LinkedIn OAuth user:", user.id);
    } else if (existingUser) {
      // User exists, update with latest LinkedIn data
      const updateData: unknown = {
        full_name: linkedinData.full_name || existingUser.full_name,
        avatar_url: linkedinData.avatar_url || existingUser.avatar_url,
      };

      // Add additional fields if they exist in your table schema
      // You can uncomment these lines after adding the columns to your users table
      // updateData.linkedin_id = linkedinData.linkedin_id;
      // updateData.provider = linkedinData.provider;
      // updateData.last_sign_in = linkedinData.last_sign_in;
      // updateData.email_verified = user.user_metadata?.email_verified || existingUser.email_verified;
      // updateData.given_name = user.user_metadata?.given_name || existingUser.given_name;
      // updateData.family_name = user.user_metadata?.family_name || existingUser.family_name;
      // updateData.locale = user.user_metadata?.locale || existingUser.locale;

      const { error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating user record:", updateError);
        throw updateError;
      }

      console.log("Updated user record for LinkedIn OAuth user:", user.id);
    }

    // Also update the profiles table if it exists
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: linkedinData.full_name,
        avatar_url: linkedinData.avatar_url,
        email: linkedinData.email,
        onboarding_completed: existingProfile?.onboarding_completed || false,
        onboarding_step: existingProfile?.onboarding_completed ? 5 : 0,
        onboarding_data: existingProfile?.onboarding_completed
          ? {}
          : {
              userType: "member", // Default, can be changed in onboarding
            },
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error("Error updating profile:", profileError);
      } else {
        console.log("Updated profile for LinkedIn OAuth user:", user.id);
      }
    } catch (profileError) {
      // Profiles table might not exist, that's okay
      console.log(
        "Profiles table not available or error updating profile:",
        profileError
      );
    }
  } catch (error) {
    console.error("Error handling LinkedIn user data:", error);
    // Don't throw - we don't want to break the auth flow
  }
}

export function extractLinkedInUserMetadata(user: User) {
  return {
    id: user.id,
    email: user.email,
    full_name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      `${user.user_metadata?.given_name || ""} ${user.user_metadata?.family_name || ""}`.trim(),
    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    linkedin_id: user.user_metadata?.sub,
    given_name: user.user_metadata?.given_name,
    family_name: user.user_metadata?.family_name,
    locale: user.user_metadata?.locale,
    email_verified: user.user_metadata?.email_verified,
    provider: "linkedin",
  };
}
