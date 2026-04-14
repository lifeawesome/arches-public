import { createClient } from "@/utils/supabase/server";
import { hasFeatureAccess } from "@/lib/utils/supabase/queries";

/**
 * Check if a user has an active platform subscription
 * Checks both subscriptions table AND subscription_tier in profiles
 * This is the unified subscription check used across the application
 * @param userId - The user_id to check
 * @returns boolean indicating if user has active subscription (via subscriptions table or subscription_tier)
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // First check: subscriptions table (preferred source)
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (subError) {
      console.warn("Subscription check failed:", subError);
    }

    if (subscription) {
      return true;
    }

    // Fallback check: subscription_tier in profiles table
    // Any tier except 'explorer' means they have a paid subscription
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.warn("Profile subscription_tier check failed:", profileError);
      return false;
    }

    // If user has a paid tier (not explorer), they have a subscription
    return !!(
      profile?.subscription_tier && profile.subscription_tier !== "explorer"
    );
  } catch (error) {
    console.warn("Error checking subscription:", error);
    return false;
  }
}

/**
 * Get user's current subscription tier
 * @returns The user's subscription tier (explorer, builder, pro, partner)
 */
export async function getUserTier(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return "explorer";
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  return profile?.subscription_tier || "explorer";
}

/**
 * Check if user has access to a feature based on tier requirement
 * @param requiredTier - The minimum tier required (builder, pro, partner)
 * @returns Object with hasAccess boolean and userTier string
 */
export async function requireTier(
  requiredTier: "builder" | "pro" | "partner"
): Promise<{ hasAccess: boolean; userTier: string; message?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasAccess: false,
      userTier: "explorer",
      message: "Please sign in to access this feature",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const userTier = profile?.subscription_tier || "explorer";
  const hasAccess = hasFeatureAccess(userTier, requiredTier);

  if (!hasAccess) {
    const tierNames: Record<string, string> = {
      builder: "Builder",
      pro: "Pro",
      partner: "Partner",
    };
    return {
      hasAccess: false,
      userTier,
      message: `This feature requires a ${tierNames[requiredTier]} subscription or higher. Your current tier: ${userTier}`,
    };
  }

  return { hasAccess: true, userTier };
}

/**
 * Client-side version of requireTier
 * @param requiredTier - The minimum tier required
 * @returns Object with hasAccess boolean and userTier string
 */
export async function requireTierClient(
  requiredTier: "builder" | "pro" | "partner"
): Promise<{ hasAccess: boolean; userTier: string; message?: string }> {
  const { createClient: createClientBrowser } = await import(
    "@/utils/supabase/client"
  );
  const supabase = createClientBrowser();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasAccess: false,
      userTier: "explorer",
      message: "Please sign in to access this feature",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const userTier = profile?.subscription_tier || "explorer";
  const { hasFeatureAccess } = await import("@/lib/utils/supabase/queries");
  const hasAccess = hasFeatureAccess(userTier, requiredTier);

  if (!hasAccess) {
    const tierNames: Record<string, string> = {
      builder: "Builder",
      pro: "Pro",
      partner: "Partner",
    };
    return {
      hasAccess: false,
      userTier,
      message: `This feature requires a ${tierNames[requiredTier]} subscription or higher. Your current tier: ${userTier}`,
    };
  }

  return { hasAccess: true, userTier };
}

