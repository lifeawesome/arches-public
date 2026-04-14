import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAppRBACProfile,
  type AppSubscriptionTier,
} from "@/lib/rbac/app-rbac";

export type FeatureName =
  | "dreamTeamConnections"
  | "activePathways"
  | "socialFeed"
  | "expertDirectory"
  | "leadTools";

export interface FeatureLimit {
  maxDreamTeamConnections: number | null; // null = unlimited
  maxActivePathways: number | null; // null = unlimited
  hasSocialFeed: boolean;
  hasExpertDirectory: boolean;
  hasLeadTools: boolean;
}

/**
 * Get feature limits based on subscription tier
 */
export function getFeatureLimits(tier: AppSubscriptionTier): FeatureLimit {
  switch (tier) {
    case "explorer":
      return {
        maxDreamTeamConnections: 3,
        maxActivePathways: 1,
        hasSocialFeed: false,
        hasExpertDirectory: false,
        hasLeadTools: false,
      };
    case "practitioner":
      return {
        maxDreamTeamConnections: null, // unlimited
        maxActivePathways: 3,
        hasSocialFeed: true,
        hasExpertDirectory: false,
        hasLeadTools: false,
      };
    case "professional":
      return {
        maxDreamTeamConnections: null, // unlimited
        maxActivePathways: null, // unlimited
        hasSocialFeed: true,
        hasExpertDirectory: true,
        hasLeadTools: false,
      };
    case "established":
      return {
        maxDreamTeamConnections: null, // unlimited
        maxActivePathways: null, // unlimited
        hasSocialFeed: true,
        hasExpertDirectory: true,
        hasLeadTools: true,
      };
    default:
      // Default to explorer limits
      return {
        maxDreamTeamConnections: 3,
        maxActivePathways: 1,
        hasSocialFeed: false,
        hasExpertDirectory: false,
        hasLeadTools: false,
      };
  }
}

/**
 * Check if user can access a specific feature
 */
export async function canAccessFeature(
  supabase: SupabaseClient,
  userId: string,
  featureName: FeatureName
): Promise<boolean> {
  const profile = await getAppRBACProfile(supabase, userId);
  if (!profile) return false;

  const limits = getFeatureLimits(profile.app_subscription_tier);

  switch (featureName) {
    case "dreamTeamConnections":
      return (
        limits.maxDreamTeamConnections !== null &&
        limits.maxDreamTeamConnections > 0
      );
    case "activePathways":
      return limits.maxActivePathways !== null && limits.maxActivePathways > 0;
    case "socialFeed":
      return limits.hasSocialFeed;
    case "expertDirectory":
      return limits.hasExpertDirectory;
    case "leadTools":
      return limits.hasLeadTools;
    default:
      return false;
  }
}

/**
 * Get feature limits for current user
 */
export async function getUserFeatureLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<FeatureLimit> {
  const profile = await getAppRBACProfile(supabase, userId);
  if (!profile) {
    // Return explorer limits as default
    return getFeatureLimits("explorer");
  }

  return getFeatureLimits(profile.app_subscription_tier);
}
