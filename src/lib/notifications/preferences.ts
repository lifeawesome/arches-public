// Utility functions for notification preferences

import {
  NotificationPreferences,
  MarketingPreferences,
  UnifiedNotificationSettings,
  EmailFrequency,
} from "@/types/notifications";

/**
 * Get default notification preferences
 */
export function getDefaultNotificationPreferences(): Omit<
  NotificationPreferences,
  "user_id" | "created_at" | "updated_at"
> {
  return {
    email_direct_messages: true,
    email_project_requests: true,
    email_system_notifications: true,
    email_frequency: "immediate",
    push_notifications: true,
    in_app_notifications: true,
  };
}

/**
 * Get default marketing preferences
 */
export function getDefaultMarketingPreferences(): Omit<
  MarketingPreferences,
  "user_id" | "created_at" | "updated_at"
> {
  return {
    newsletter_subscribed: true,
    product_updates_subscribed: true,
    event_invitations_subscribed: true,
    success_stories_subscribed: true,
    partner_offers_subscribed: false,
  };
}

/**
 * Merge user preferences with defaults
 */
export function mergeNotificationPreferences(
  userPrefs: Partial<NotificationPreferences> | null,
  defaults: ReturnType<typeof getDefaultNotificationPreferences>
): Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at"> {
  return {
    email_direct_messages:
      userPrefs?.email_direct_messages ?? defaults.email_direct_messages,
    email_project_requests:
      userPrefs?.email_project_requests ?? defaults.email_project_requests,
    email_system_notifications:
      userPrefs?.email_system_notifications ??
      defaults.email_system_notifications,
    email_frequency: userPrefs?.email_frequency ?? defaults.email_frequency,
    push_notifications:
      userPrefs?.push_notifications ?? defaults.push_notifications,
    in_app_notifications:
      userPrefs?.in_app_notifications ?? defaults.in_app_notifications,
  };
}

/**
 * Merge marketing preferences with defaults
 */
export function mergeMarketingPreferences(
  userPrefs: Partial<MarketingPreferences> | null,
  defaults: ReturnType<typeof getDefaultMarketingPreferences>
): Omit<MarketingPreferences, "user_id" | "created_at" | "updated_at"> {
  return {
    newsletter_subscribed:
      userPrefs?.newsletter_subscribed ?? defaults.newsletter_subscribed,
    product_updates_subscribed:
      userPrefs?.product_updates_subscribed ??
      defaults.product_updates_subscribed,
    event_invitations_subscribed:
      userPrefs?.event_invitations_subscribed ??
      defaults.event_invitations_subscribed,
    success_stories_subscribed:
      userPrefs?.success_stories_subscribed ??
      defaults.success_stories_subscribed,
    partner_offers_subscribed:
      userPrefs?.partner_offers_subscribed ?? defaults.partner_offers_subscribed,
  };
}

/**
 * Combine notification and marketing preferences into unified settings
 */
export function unifyNotificationSettings(
  notificationPrefs: Partial<NotificationPreferences> | null,
  marketingPrefs: Partial<MarketingPreferences> | null
): UnifiedNotificationSettings {
  const defaultNotification = getDefaultNotificationPreferences();
  const defaultMarketing = getDefaultMarketingPreferences();

  const mergedNotification = mergeNotificationPreferences(
    notificationPrefs,
    defaultNotification
  );
  const mergedMarketing = mergeMarketingPreferences(
    marketingPrefs,
    defaultMarketing
  );

  return {
    email_direct_messages: mergedNotification.email_direct_messages,
    email_project_requests: mergedNotification.email_project_requests,
    email_system_notifications: mergedNotification.email_system_notifications,
    email_frequency: mergedNotification.email_frequency,
    push_notifications: mergedNotification.push_notifications,
    in_app_notifications: mergedNotification.in_app_notifications ?? true,
    newsletter_subscribed: mergedMarketing.newsletter_subscribed,
    product_updates_subscribed: mergedMarketing.product_updates_subscribed,
    event_invitations_subscribed: mergedMarketing.event_invitations_subscribed,
    success_stories_subscribed: mergedMarketing.success_stories_subscribed,
    partner_offers_subscribed: mergedMarketing.partner_offers_subscribed,
  };
}

/**
 * Validate email frequency value
 */
export function isValidEmailFrequency(
  frequency: string
): frequency is EmailFrequency {
  return ["immediate", "hourly", "daily", "weekly"].includes(frequency);
}

/**
 * Validate notification preferences update
 */
export function validateNotificationPreferences(
  prefs: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (
    "email_frequency" in prefs &&
    !isValidEmailFrequency(prefs.email_frequency as string)
  ) {
    errors.push(
      "email_frequency must be one of: immediate, hourly, daily, weekly"
    );
  }

  // Check boolean fields
  const booleanFields = [
    "email_direct_messages",
    "email_project_requests",
    "email_system_notifications",
    "push_notifications",
    "in_app_notifications",
    "newsletter_subscribed",
    "product_updates_subscribed",
    "event_invitations_subscribed",
    "success_stories_subscribed",
    "partner_offers_subscribed",
  ];

  for (const field of booleanFields) {
    if (field in prefs && typeof prefs[field] !== "boolean") {
      errors.push(`${field} must be a boolean`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

