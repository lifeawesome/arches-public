/**
 * Expert-specific utilities for masking expert information based on subscription status
 *
 * Note: For subscription checking, use hasActiveSubscription from @/utils/tier-access
 */

/**
 * Mask sensitive expert information for non-subscribers
 * @param expert - Expert object with full information
 * @param hasSubscription - Whether the expert has an active subscription
 * @returns Expert object with masked information if no subscription
 */
export function maskExpertInfo<T extends Record<string, unknown>>(
  expert: T,
  hasSubscription: boolean
): T {
  if (hasSubscription) {
    return expert;
  }

  // Create a copy to avoid mutating the original
  const masked = { ...expert };

  // Mask full name - show first name + initial
  if (
    masked.resume_parsed_content &&
    typeof masked.resume_parsed_content === "object" &&
    "personal_info" in masked.resume_parsed_content &&
    masked.resume_parsed_content.personal_info &&
    typeof masked.resume_parsed_content.personal_info === "object" &&
    "name" in masked.resume_parsed_content.personal_info
  ) {
    const personalInfo = masked.resume_parsed_content.personal_info as { name?: string };
    const name = personalInfo.name;
    if (name) {
      const parts = name.split(" ");
      if (parts.length > 1) {
        personalInfo.name = `${parts[0]} ${parts[parts.length - 1][0]}.`;
      }
    }
  }

  // If there's a profile full_name, mask it too
  if (
    "profiles" in masked &&
    masked.profiles &&
    typeof masked.profiles === "object" &&
    "full_name" in masked.profiles
  ) {
    const profiles = masked.profiles as { full_name?: unknown };
    const name = profiles.full_name as string;
    if (typeof name === "string") {
      const parts = name.split(" ");
      if (parts.length > 1) {
        (masked as unknown as { profiles: { full_name?: string } }).profiles = {
          ...profiles,
          full_name: `${parts[0]} ${parts[parts.length - 1][0]}.`,
        };
      }
    }
  }

  // Remove social links
  (masked as unknown as { linkedin_url?: string | undefined | null }).linkedin_url = null;
  (masked as unknown as { github_url?: string | undefined | null }).github_url = null;
  (masked as unknown as { twitter_url?: string | undefined | null }).twitter_url = null;
  (masked as unknown as { facebook_url?: string | undefined | null }).facebook_url = null;
  (masked as unknown as { instagram_url?: string | undefined | null }).instagram_url = null;
  (masked as unknown as { portfolio_url?: string | undefined | null }).portfolio_url = null;
  (masked as unknown as { website_url?: string | undefined | null }).website_url = null;

  // Remove personal contact info from resume
  if (
    masked.resume_parsed_content &&
    typeof masked.resume_parsed_content === "object" &&
    "personal_info" in masked.resume_parsed_content
  ) {
    const resumeContent = masked.resume_parsed_content as { personal_info?: { email?: string | null; phone?: string | null; address?: string | null } };
    if (resumeContent.personal_info) {
      resumeContent.personal_info = {
        ...resumeContent.personal_info,
        email: null,
        phone: null,
        address: null,
      };
    }
  }

  // Add flag to indicate masked state
  (masked as unknown as { _is_masked?: boolean })._is_masked = true;
  (masked as unknown as { _subscription_required?: boolean })._subscription_required = true;

  return masked;
}
