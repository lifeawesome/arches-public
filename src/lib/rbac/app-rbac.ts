/**
 * App-wide RBAC (platform identity), not community permissions.
 *
 * Product reasoning:
 * - Arches has two different "who are you here?" problems. This file answers the **platform**
 *   question: Are you a normal member, internal staff/manager, or platform admin? What **product
 *   subscription tier** do you pay for (explorer → established)? That drives `/admin`, internal
 *   tools, pricing gates, and cross-cutting product capabilities.
 * - **Circles** answer a different question: inside a given community, are you owner, moderator, 
 *   member, blocked, allowed to post, etc. That logic lives in `src/lib/utils/circles/access-control.ts`
 *   and circle settings — on purpose. A platform administrator is not automatically a circle
 *   owner; a paying subscriber can still be kicked from a circle. Mixing those models in one
 *   column would make both product rules and security reviews painful.
 * - `app_access_level` / `app_subscription_tier` are separate from legacy `role` /
 *   `subscription_tier` columns so we can migrate and reason about the new app without breaking
 *   old data assumptions in one shot.
 *
 * Rule of thumb: if the question is "Arches the product vs this user," use this module; if it's
 * "this circle vs this user," use circle access control.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types_db";

export type AppAccessLevel = 'user' | 'manager' | 'administrator';
export type AppSubscriptionTier = 'explorer' | 'practitioner' | 'professional' | 'established';

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
  requiredLevel: AppAccessLevel
): boolean {
  return ACCESS_LEVEL_HIERARCHY[userLevel] >= ACCESS_LEVEL_HIERARCHY[requiredLevel];
}

/**
 * Check if user has required subscription tier
 * @param userTier - User's current subscription tier
 * @param requiredTier - Minimum required subscription tier
 * @returns true if user meets or exceeds required tier
 */
export function hasAppSubscriptionTier(
  userTier: AppSubscriptionTier,
  requiredTier: AppSubscriptionTier
): boolean {
  return SUBSCRIPTION_TIER_HIERARCHY[userTier] >= SUBSCRIPTION_TIER_HIERARCHY[requiredTier];
}

/**
 * Get user's app RBAC profile from Supabase
 * @param supabase - Supabase client instance
 * @param userId - User ID to fetch profile for
 * @returns AppRBACProfile or null if not found
 */
export async function getAppRBACProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AppRBACProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, app_access_level, app_subscription_tier')
    .eq('id', userId)
    .single();
  
  if (error || !data) {
    return null;
  }

  // `SupabaseClient<Database>` + stub `types_db` can infer `data` as `never` here; narrow via `unknown`.
  const row = data as unknown as ProfileRbacRow;

  return {
    id: row.id,
    app_access_level: (row.app_access_level || "user") as AppAccessLevel,
    app_subscription_tier: (row.app_subscription_tier || "explorer") as AppSubscriptionTier,
  };
}

/**
 * Check if current user is an administrator (client-side)
 * @param supabase - Supabase client instance
 * @returns true if user is administrator
 */
export async function isAppAdministrator(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const profile = await getAppRBACProfile(supabase, user.id);
  return profile?.app_access_level === 'administrator';
}

/**
 * Check if current user is a manager or administrator (client-side)
 * @param supabase - Supabase client instance
 * @returns true if user is manager or administrator
 */
export async function isAppManagerOrAdmin(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const profile = await getAppRBACProfile(supabase, user.id);
  if (!profile) return false;
  
  return hasAppAccessLevel(profile.app_access_level, 'manager');
}

/**
 * Check if current user has required subscription tier (client-side)
 * @param supabase - Supabase client instance
 * @param requiredTier - Minimum required tier
 * @returns true if user has required tier or higher
 */
export async function hasRequiredSubscriptionTier(
  supabase: SupabaseClient<Database>,
  requiredTier: AppSubscriptionTier
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const profile = await getAppRBACProfile(supabase, user.id);
  if (!profile) return false;
  
  return hasAppSubscriptionTier(profile.app_subscription_tier, requiredTier);
}

