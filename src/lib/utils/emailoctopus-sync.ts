/**
 * Utility function to sync a user to EmailOctopus
 * This can be called from various places in the app (signup, profile update, etc.)
 */

import {
  syncUserToEmailOctopus,
  isEmailOctopusConfigured,
} from "@/services/emailoctopus";
import { createClient } from "@/utils/supabase/server";

export interface SyncUserToEmailOctopusParams {
  userId: string;
  email: string;
  fullName?: string;
}

/**
 * Syncs a user to EmailOctopus and updates their marketing preferences
 * This function is safe to call multiple times - it will update existing contacts
 */
export async function syncUserWithEmailOctopus(
  params: SyncUserToEmailOctopusParams
): Promise<{ success: boolean; error?: string }> {
  // Skip if EmailOctopus is not configured
  if (!isEmailOctopusConfigured()) {
    console.log("EmailOctopus not configured, skipping sync");
    return { success: true };
  }

  try {
    const { userId, email, fullName } = params;

    // Parse name
    const nameParts = fullName?.split(" ") || [];
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Get user's marketing preferences
    const supabase = await createClient();
    const { data: preferences } = await supabase
      .from("marketing_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Sync to EmailOctopus with preferences
    const { contactId, isNew } = await syncUserToEmailOctopus(
      email,
      firstName,
      lastName,
      preferences
        ? {
            newsletter_subscribed: preferences.newsletter_subscribed,
            product_updates_subscribed: preferences.product_updates_subscribed,
            event_invitations_subscribed:
              preferences.event_invitations_subscribed,
            success_stories_subscribed: preferences.success_stories_subscribed,
            partner_offers_subscribed: preferences.partner_offers_subscribed,
          }
        : undefined
    );

    // Update the marketing preferences with the contact ID
    if (contactId && preferences) {
      await supabase
        .from("marketing_preferences")
        .update({ emailoctopus_contact_id: contactId })
        .eq("user_id", userId);
    }

    console.log(
      `EmailOctopus sync ${isNew ? "created" : "updated"} contact for user ${userId}`
    );

    return { success: true };
  } catch (error: any) {
    console.error("Error syncing user to EmailOctopus:", error);
    // Don't fail the overall operation if EmailOctopus sync fails
    return { success: false, error: error.message };
  }
}
