/**
 * New App RBAC Utilities
 * 
 * This module provides Role-Based Access Control (RBAC) utilities for the new app.
 * It uses app_access_level and app_subscription_tier columns, which are separate
 * from the old app's role and subscription_tier columns.
 */

export type AppAccessLevel = 'user' | 'manager' | 'administrator';
export type AppSubscriptionTier = 'explorer' | 'practitioner' | 'professional' | 'established';

export interface AppRBACProfile {
  id: string;
  app_access_level: AppAccessLevel;
  app_subscription_tier: AppSubscriptionTier;
}

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
  supabase: any,
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
  
  return {
    id: data.id,
    app_access_level: (data.app_access_level || 'user') as AppAccessLevel,
    app_subscription_tier: (data.app_subscription_tier || 'explorer') as AppSubscriptionTier,
  };
}

/**
 * Check if current user is an administrator (client-side)
 * @param supabase - Supabase client instance
 * @returns true if user is administrator
 */
export async function isAppAdministrator(supabase: any): Promise<boolean> {
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
export async function isAppManagerOrAdmin(supabase: any): Promise<boolean> {
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
  supabase: any,
  requiredTier: AppSubscriptionTier
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const profile = await getAppRBACProfile(supabase, user.id);
  if (!profile) return false;
  
  return hasAppSubscriptionTier(profile.app_subscription_tier, requiredTier);
}

