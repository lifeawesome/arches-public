import { createClient } from "@/utils/supabase/client";

export type ActivityType = "saved" | "connection" | "event_registration";
export type ItemType =
  | "expert"
  | "offer"
  | "circle"
  | "post"
  | "event"
  | "user"
  | "circle_event"
  | "public_event";

interface ActivityFeedItem {
  user_id: string;
  action_type: ActivityType;
  item_type: ItemType;
  item_id: string;
  created_at: string;
  metadata?: Record<string, any>;
}

/**
 * Get activity feed for a user
 */
export async function getActivityFeed(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ data: ActivityFeedItem[] | null; error: string | null }> {
  const supabase = createClient();
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  try {
    const { data, error } = await supabase
      .from("user_activity_feed")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching activity feed:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    console.error("Error in getActivityFeed:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Track a save action
 * Note: The actual save is done through the saved-items utilities
 * This is just for querying the activity feed
 */
export async function trackSaveItem(
  userId: string,
  itemType: "expert" | "offer" | "circle" | "post" | "event",
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  // Tracking is automatic through the database view
  // No need to manually insert into activity feed
  return { success: true };
}

/**
 * Track a connection action
 * Note: The actual connection is done through the network-connections utilities
 * This is just for querying the activity feed
 */
export async function trackConnectionAction(
  userId: string,
  action: "connect" | "accept" | "remove",
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  // Tracking is automatic through the database view
  // No need to manually insert into activity feed
  return { success: true };
}

/**
 * Track an event registration
 * Note: The actual registration is done through the event registration utilities
 * This is just for querying the activity feed
 */
export async function trackEventRegistration(
  userId: string,
  eventType: "circle_event" | "public_event",
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  // Tracking is automatic through the database view
  // No need to manually insert into activity feed
  return { success: true };
}

/**
 * Get activity feed statistics for a user
 */
export async function getActivityStats(userId: string): Promise<{
  total_activities: number;
  saved_count: number;
  connections_count: number;
  event_registrations_count: number;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("user_activity_feed")
      .select("action_type")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching activity stats:", error);
      return {
        total_activities: 0,
        saved_count: 0,
        connections_count: 0,
        event_registrations_count: 0,
        error: error.message,
      };
    }

    const stats = {
      total_activities: data.length,
      saved_count: data.filter(
        (item: { action_type: string }) => item.action_type === "saved"
      ).length,
      connections_count: data.filter(
        (item: { action_type: string }) => item.action_type === "connection"
      ).length,
      event_registrations_count: data.filter(
        (item: { action_type: string }) =>
          item.action_type === "event_registration"
      ).length,
    };

    return stats;
  } catch (err) {
    console.error("Error in getActivityStats:", err);
    return {
      total_activities: 0,
      saved_count: 0,
      connections_count: 0,
      event_registrations_count: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get recent activity for display in dashboard
 * Returns formatted activity items with user-friendly descriptions
 */
export async function getRecentActivity(
  userId: string,
  limit: number = 10
): Promise<{
  data: Array<{
    id: string;
    type: ActivityType;
    description: string;
    timestamp: string;
    itemType: ItemType;
    itemId: string;
  }> | null;
  error?: string;
}> {
  const { data, error } = await getActivityFeed(userId, { limit });

  if (error || !data) {
    return { data: null, error: error ?? undefined };
  }

  const formattedActivities = data.map((activity, index) => ({
    id: `activity-${index}-${activity.created_at}`,
    type: activity.action_type,
    description: formatActivityDescription(
      activity.action_type,
      activity.item_type
    ),
    timestamp: activity.created_at,
    itemType: activity.item_type,
    itemId: activity.item_id,
  }));

  return { data: formattedActivities };
}

/**
 * Format activity description for display
 */
function formatActivityDescription(
  actionType: ActivityType,
  itemType: ItemType
): string {
  const typeMap: Record<ItemType, string> = {
    expert: "expert",
    offer: "offer",
    circle: "circle",
    post: "post",
    event: "event",
    user: "member",
    circle_event: "circle event",
    public_event: "event",
  };

  switch (actionType) {
    case "saved":
      return `Saved a ${typeMap[itemType]}`;
    case "connection":
      return `Connected with a ${typeMap[itemType]}`;
    case "event_registration":
      return `Registered for a ${typeMap[itemType]}`;
    default:
      return "Unknown activity";
  }
}

/**
 * Delete old activity entries (cleanup function)
 * Typically called by a scheduled job
 */
export async function cleanupOldActivity(
  daysToKeep: number = 90
): Promise<{ success: boolean; deleted: number; error?: string }> {
  const supabase = createClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    // Note: This would need to be run with elevated permissions
    // The view is read-only, so cleanup would need to target the source tables
    // This is just a placeholder for the concept

    console.log(
      `Would clean up activity older than ${cutoffDate.toISOString()}`
    );

    return {
      success: true,
      deleted: 0,
    };
  } catch (err) {
    console.error("Error in cleanupOldActivity:", err);
    return {
      success: false,
      deleted: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
