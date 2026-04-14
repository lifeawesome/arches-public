import { createClient } from "@/utils/supabase/client";

export interface MemberAccessResult {
  hasAccess: boolean;
  reason?:
    | "active_subscription"
    | "trial"
    | "no_subscription"
    | "expired"
    | "not_authenticated";
  message?: string;
  subscription?: {
    id: string;
    status: string;
    user_id: string;
    current_period_start: string;
    current_period_end: string;
    trial_start?: string;
    trial_end?: string;
  };
}

export async function checkMemberAccess(): Promise<MemberAccessResult> {
  try {
    // Development override: Allow spoofing member access in development
    if (process.env.NODE_ENV === "development") {
      const devOverride = process.env.NEXT_PUBLIC_DEV_MEMBER_ACCESS;
      if (devOverride === "true") {
        return {
          hasAccess: true,
          reason: "active_subscription",
          message: "Development override: You have an active membership",
          subscription: {
            id: "dev_subscription",
            status: "active",
            user_id: "dev_user",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // 30 days from now
          },
        };
      } else if (devOverride === "trial") {
        return {
          hasAccess: true,
          reason: "trial",
          message:
            "Development override: You have access during your trial period",
          subscription: {
            id: "dev_trial_subscription",
            status: "trialing",
            user_id: "dev_user",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(), // 30 days from now
            trial_start: new Date().toISOString(),
            trial_end: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(), // 7 days from now
          },
        };
      } else if (devOverride === "false") {
        return {
          hasAccess: false,
          reason: "no_subscription",
          message:
            "Development override: A membership is required to access this feature",
        };
      }
      // If devOverride is not set or any other value, continue with normal flow
    }

    const supabase = createClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        hasAccess: false,
        reason: "not_authenticated",
        message: "Please sign in to access member features",
      };
    }

    // Check for active subscription in subscriptions table
    const {
      data: subscription,
      error: subError,
    }: {
      data: {
        status: string;
        id: string;
        user_id: string;
        current_period_start: string;
        current_period_end: string;
      } | null;
      error: Error | null;
    } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["trialing", "active"])
      .maybeSingle();

    if (subError) {
      // Silently handle subscription check errors
      console.warn(
        "Subscription check failed (this is normal for new users):",
        subError.message || subError
      );
    }

    if (subscription) {
      return {
        hasAccess: true,
        reason:
          subscription.status === "trialing" ? "trial" : "active_subscription",
        message:
          subscription.status === "trialing"
            ? "You have access during your trial period"
            : "You have an active membership",
        subscription: {
          id: subscription.id,
          status: subscription.status,
          user_id: subscription.user_id,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
        },
      };
    }

    // Fallback: Check subscription_tier in profiles table
    // This handles cases where Stripe subscription exists but hasn't synced to subscriptions table yet
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.warn("Profile check failed:", profileError.message);
    }

    // If user has a paid tier (not explorer), grant access
    if (profile && profile.subscription_tier && profile.subscription_tier !== "explorer") {
      return {
        hasAccess: true,
        reason: "active_subscription",
        message: `You have an active ${profile.subscription_tier} membership`,
        subscription: {
          id: "profile_tier_" + user.id,
          status: "active",
          user_id: user.id,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000
          ).toISOString(), // Assume 1 year
        },
      };
    }

    // No active subscription found
    return {
      hasAccess: false,
      reason: "no_subscription",
      message: "A membership is required to access this feature",
    };
  } catch (error) {
    // Silently handle unexpected errors - don't crash the app
    console.warn(
      "Member access check failed:",
      error instanceof Error ? error.message : error
    );
    return {
      hasAccess: false,
      reason: "no_subscription",
      message: "A membership is required to access this feature",
    };
  }
}

export async function requireMemberAccess(): Promise<MemberAccessResult> {
  const accessResult = await checkMemberAccess();

  if (!accessResult.hasAccess) {
    // Could redirect to pricing page or show upgrade modal
    console.warn("Member access required:", accessResult.message);
  }

  return accessResult;
}

/**
 * Development utility functions for spoofing member access.
 * Only works in development environment.
 */
export const devMemberAccess = {
  /**
   * Set development member access status
   * @param status - "true" for active member, "trial" for trial member, "false" for no access
   */
  setStatus: (status: "true" | "trial" | "false") => {
    if (process.env.NODE_ENV !== "development") {
      console.warn(
        "devMemberAccess.setStatus() only works in development environment"
      );
      return;
    }

    // This sets the environment variable for the current session
    // Note: In Next.js, you'll need to restart the dev server for this to take effect
    // or set it in your .env.local file
    console.log(`🔧 Development: Setting member access to "${status}"`);
    console.log(
      `Add this to your .env.local file: NEXT_PUBLIC_DEV_MEMBER_ACCESS=${status}`
    );
    console.log(`Then restart your development server.`);
  },

  /**
   * Get current development override status
   */
  getStatus: () => {
    if (process.env.NODE_ENV !== "development") {
      return null;
    }
    return process.env.NEXT_PUBLIC_DEV_MEMBER_ACCESS || "not_set";
  },

  /**
   * Clear development override (use real subscription check)
   */
  clearOverride: () => {
    if (process.env.NODE_ENV !== "development") {
      console.warn(
        "devMemberAccess.clearOverride() only works in development environment"
      );
      return;
    }
    console.log(`🔧 Development: Clearing member access override`);
    console.log(
      `Remove NEXT_PUBLIC_DEV_MEMBER_ACCESS from your .env.local file`
    );
    console.log(`Then restart your development server.`);
  },
};
