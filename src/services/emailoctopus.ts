/**
 * EmailOctopus service
 * Stub implementation for build compatibility
 */

export function isEmailOctopusConfigured(): boolean {
  return !!(
    process.env.EMAILOCTOPUS_API_KEY && process.env.EMAILOCTOPUS_LIST_ID
  );
}

export async function syncUserToEmailOctopus(
  email: string,
  firstName?: string,
  lastName?: string,
  preferences?: {
    newsletter_subscribed?: boolean;
    product_updates_subscribed?: boolean;
    event_invitations_subscribed?: boolean;
    success_stories_subscribed?: boolean;
    partner_offers_subscribed?: boolean;
  }
): Promise<{ contactId: string; isNew: boolean }> {
  // Stub implementation - returns a placeholder
  return {
    contactId: `stub-${Date.now()}`,
    isNew: true,
  };
}

