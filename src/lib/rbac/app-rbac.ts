/**
 * App-wide RBAC (platform identity), not community permissions.
 *
 * I think of Arches as having two separate questions we never want to smush together. First:
 * "What kind of Arches customer are you, and what did you buy?" — regular user, someone on our
 * team with extra internal access, platform admin, and which subscription tier you're on. That's
 * what I use this file for: the stuff that powers admin areas, pricing, and anything that applies
 * to you as an Arches account, not as a member of one specific group.
 *
 * Second question: "Inside this particular circle, who are you?" — owner, moderator, member, can
 * you post, were you blocked, all of that. That lives elsewhere (`access-control.ts`) because it's
 * community rules, not "your relationship to Arches the company." I keep them apart on purpose:
 * our own admins aren't secretly mods of every community, and someone paying us doesn't get a free
 * pass to ignore a circle's rules. If we stored both ideas in one place, we'd confuse people and
 * we'd ship bugs.
 *
 * The columns here (`app_access_level`, `app_subscription_tier`) are also intentionally separate
 * from older legacy fields so we could move to the new model without breaking historical data in
 * one risky cutover.
 *
 * TL;DR for engineers:
 * "Arches vs this user" → use this module's functions;
 * "this circle vs this user" → use access-control.ts instead.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types_db";

export type AppAccessLevel = "user" | "manager" | "administrator";
export type AppSubscriptionTier =
  | "explorer"
  | "practitioner"
  | "professional"
  | "established";

export interface AppRBACProfile {
  id: string;
  app_access_level: AppAccessLevel;
  app_subscription_tier: AppSubscriptionTier;
}

/** Shape of `profiles` columns we read in this module (stub `Database` types don’t narrow `.from()` well). */
type ProfileRbacRow = {
  id: string;
  app_access_level: string | null;
  app_subscription_tier: string | null;
};

const ACCESS_LEVEL_HIERARCHY: Record<AppAccessLevel, number> = {
  user: 1,
  manager: 2,
  administrator: 3,
};

const SUBSCRIPTION_TIER_HIERARCHY: Record<AppSubscriptionTier, number> = {
  explorer: 1,
  practitioner: 2,
  professional: 3,
  established: 4,
};

/**
 * Check if user has required access level
 * @param userLevel - User's current access level
 * @param requiredLevel - Minimum required access level
 * @returns true if user meets or exceeds required level
 */
export function hasAppAccessLevel(
  userLevel: AppAccessLevel,
  requiredLevel: AppAccessLevel,
): boolean {
  return (
    ACCESS_LEVEL_HIERARCHY[userLevel] >= ACCESS_LEVEL_HIERARCHY[requiredLevel]
  );
}

/**
 * Check if user has required subscription tier
 * @param userTier - User's current subscription tier
 * @param requiredTier - Minimum required subscription tier
 * @returns true if user meets or exceeds required tier
 */
export function hasAppSubscriptionTier(
  userTier: AppSubscriptionTier,
  requiredTier: AppSubscriptionTier,
): boolean {
  return (
    SUBSCRIPTION_TIER_HIERARCHY[userTier] >=
    SUBSCRIPTION_TIER_HIERARCHY[requiredTier]
  );
}

/**
 * Get user's app RBAC profile from Supabase
 * @param supabase - Supabase client instance
 * @param userId - User ID to fetch profile for
 * @returns AppRBACProfile or null if not found
 */
export async function getAppRBACProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AppRBACProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, app_access_level, app_subscription_tier")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  // `SupabaseClient<Database>` + stub `types_db` can infer `data` as `never` here; narrow via `unknown`.
  const row = data as unknown as ProfileRbacRow;

  return {
    id: row.id,
    app_access_level: (row.app_access_level || "user") as AppAccessLevel,
    app_subscription_tier: (row.app_subscription_tier ||
      "explorer") as AppSubscriptionTier,
  };
}

/**
 * Check if current user is an administrator (client-side)
 * @param supabase - Supabase client instance
 * @returns true if user is administrator
 */
export async function isAppAdministrator(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const profile = await getAppRBACProfile(supabase, user.id);
  return profile?.app_access_level === "administrator";
}

/**
 * Check if current user is a manager or administrator (client-side)
 * @param supabase - Supabase client instance
 * @returns true if user is manager or administrator
 */
export async function isAppManagerOrAdmin(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const profile = await getAppRBACProfile(supabase, user.id);
  if (!profile) return false;

  return hasAppAccessLevel(profile.app_access_level, "manager");
}

/**
 * Check if current user has required subscription tier (client-side)
 * @param supabase - Supabase client instance
 * @param requiredTier - Minimum required tier
 * @returns true if user has required tier or higher
 */
export async function hasRequiredSubscriptionTier(
  supabase: SupabaseClient<Database>,
  requiredTier: AppSubscriptionTier,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const profile = await getAppRBACProfile(supabase, user.id);
  if (!profile) return false;

  return hasAppSubscriptionTier(profile.app_subscription_tier, requiredTier);
}
