import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NotificationEvent,
  NotificationEventType,
  CircleNotificationSettingsResponse,
} from "@/types/notifications";

export interface UserXP {
  totalXP: number;
}

export interface UserStreak {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}


export interface TodayTask {
  id: string;
  taskId: string;
  pathwayId: string;
  status: string;
  task: {
    id: string;
    title: string;
    objective: string;
    timeMin: number;
    timeMax: number;
    xpValue: number;
  };
  pathway: {
    id: string;
    title: string;
  };
}

/**
 * Calculate total XP for a user from the XP ledger
 */
export async function getUserXP(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("user_xp_ledger")
    .select("xp_delta")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching XP:", error);
    return 0;
  }

  const totalXP =
    data?.reduce((sum, entry) => sum + (entry.xp_delta || 0), 0) || 0;
  return totalXP;
}

/**
 * Get user's current streak information
 */
export async function getUserStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStreak> {
  const { data, error } = await supabase
    .from("user_streaks")
    .select("current_streak, best_streak, last_activity_date")
    .eq("user_id", userId)
    .single();

  if (error) {
    // If no streak record exists, create one with defaults
    if (error.code === "PGRST116") {
      return {
        currentStreak: 0,
        bestStreak: 0,
        lastActivityDate: null,
      };
    }
    console.error("Error fetching streak:", error);
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastActivityDate: null,
    };
  }

  return {
    currentStreak: data.current_streak || 0,
    bestStreak: data.best_streak || 0,
    lastActivityDate: data.last_activity_date || null,
  };
}

/**
 * Get user notifications from notification_events table
 */
export async function getUserNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  unreadOnly: boolean = false,
  eventTypes?: NotificationEventType[]
): Promise<NotificationEvent[]> {
  let query = supabase
    .from("notification_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  if (eventTypes && eventTypes.length > 0) {
    query = query.in("event_type", eventTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return (data || []) as NotificationEvent[];
}

/**
 * Get unread notifications count
 */
export async function getUnreadNotificationsCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notification_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50
): Promise<NotificationEvent[]> {
  return getUserNotifications(supabase, userId, limit, true);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notification_events")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error marking notification as read:", error);
    return false;
  }

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("notification_events")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    console.error("Error marking all notifications as read:", error);
    return false;
  }

  return true;
}

/**
 * Get notification count (total and unread)
 */
export async function getNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ total: number; unread: number }> {
  const [totalResult, unreadResult] = await Promise.all([
    supabase
      .from("notification_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("notification_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  return {
    total: totalResult.count || 0,
    unread: unreadResult.count || 0,
  };
}

/**
 * Get unread Circle notifications count for a specific circle
 */
export async function getUnreadCircleNotificationsCount(
  supabase: SupabaseClient,
  userId: string,
  circleId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notification_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
    .in("event_type", [
      "circle_post_created",
      "circle_comment_created",
      "circle_post_approved",
      "circle_post_rejected",
      "circle_user_mentioned",
      "circle_member_joined",
      "circle_role_changed",
      "circle_reaction_added",
      "circle_invitation_received",
    ] as NotificationEventType[])
    .eq("metadata->>circle_id", circleId);

  if (error) {
    console.error("Error fetching unread Circle notifications count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get notifications for a specific Circle
 */
export async function getCircleNotifications(
  supabase: SupabaseClient,
  userId: string,
  circleId: string,
  limit: number = 50,
  unreadOnly: boolean = false
): Promise<NotificationEvent[]> {
  const circleEventTypes: NotificationEventType[] = [
    "circle_post_created",
    "circle_comment_created",
    "circle_post_approved",
    "circle_post_rejected",
    "circle_user_mentioned",
    "circle_member_joined",
    "circle_role_changed",
    "circle_reaction_added",
    "circle_invitation_received",
  ];

  const { data, error } = await supabase
    .from("notification_events")
    .select("*")
    .eq("user_id", userId)
    .eq("metadata->>circle_id", circleId)
    .in("event_type", circleEventTypes)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching Circle notifications:", error);
    return [];
  }

  let notifications = (data || []) as NotificationEvent[];

  if (unreadOnly) {
    notifications = notifications.filter((n) => n.read_at === null);
  }

  return notifications;
}

/**
 * Get effective notification settings for a specific circle.
 * This is a convenience wrapper around the circle_notification_preferences
 * and user_notification_preferences tables for UI use.
 */
export async function getCircleNotificationSettings(
  supabase: SupabaseClient,
  userId: string,
  circleId: string
): Promise<CircleNotificationSettingsResponse | null> {
  const [{ data: globalPrefs }, { data: circlePrefs }] = await Promise.all([
    supabase
      .from("user_notification_preferences")
      .select(
        "in_app_notifications, email_system_notifications, push_notifications"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("circle_notification_preferences")
      .select(
        "notify_posts, notify_comments, notify_mentions, notify_membership, notify_reactions"
      )
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .maybeSingle(),
  ]);

  if (!globalPrefs) {
    return null;
  }

  return {
    circle_id: circleId,
    in_app_notifications:
      globalPrefs.in_app_notifications ?? true,
    email_system_notifications:
      globalPrefs.email_system_notifications ?? false,
    push_notifications: globalPrefs.push_notifications ?? false,
    notify_posts: circlePrefs?.notify_posts ?? true,
    notify_comments: circlePrefs?.notify_comments ?? true,
    notify_mentions: circlePrefs?.notify_mentions ?? true,
    notify_membership: circlePrefs?.notify_membership ?? false,
    notify_reactions: circlePrefs?.notify_reactions ?? false,
  };
}

/**
 * Get a task instance by ID
 */
export async function getTaskById(
  supabase: SupabaseClient,
  userId: string,
  taskInstanceId: string
): Promise<TodayTask | null> {
  const { data, error } = await supabase
    .from("user_task_instances")
    .select(
      `
      id,
      task_id,
      pathway_id,
      status,
      tasks:task_id (
        id,
        title,
        objective,
        time_min,
        time_max,
        xp_value
      ),
      pathways:pathway_id (
        id,
        title
      )
    `
    )
    .eq("id", taskInstanceId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Task not found
      return null;
    }
    console.error("Error fetching task by ID:", error);
    return null;
  }

  const task = Array.isArray(data.tasks) ? data.tasks[0] : data.tasks;
  const pathway = Array.isArray(data.pathways)
    ? data.pathways[0]
    : data.pathways;

  if (!task || !pathway) {
    return null;
  }

  return {
    id: data.id,
    taskId: data.task_id,
    pathwayId: data.pathway_id,
    status: data.status,
    task: {
      id: task.id,
      title: task.title,
      objective: task.objective,
      timeMin: task.time_min,
      timeMax: task.time_max,
      xpValue: task.xp_value,
    },
    pathway: {
      id: pathway.id,
      title: pathway.title,
    },
  };
}

/**
 * Get today's assigned task for a user
 */
export async function getTodayTask(
  supabase: SupabaseClient,
  userId: string
): Promise<TodayTask | null> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("user_task_instances")
    .select(
      `
      id,
      task_id,
      pathway_id,
      status,
      tasks:task_id (
        id,
        title,
        objective,
        time_min,
        time_max,
        xp_value
      ),
      pathways:pathway_id (
        id,
        title
      )
    `
    )
    .eq("user_id", userId)
    .eq("assigned_for_date", today)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No task found for today
      return null;
    }
    console.error("Error fetching today's task:", error);
    return null;
  }

  const task = Array.isArray(data.tasks) ? data.tasks[0] : data.tasks;
  const pathway = Array.isArray(data.pathways)
    ? data.pathways[0]
    : data.pathways;

  return {
    id: data.id,
    taskId: data.task_id,
    pathwayId: data.pathway_id,
    status: data.status,
    task: {
      id: task.id,
      title: task.title,
      objective: task.objective,
      timeMin: task.time_min,
      timeMax: task.time_max,
      xpValue: task.xp_value,
    },
    pathway: {
      id: pathway.id,
      title: pathway.title,
    },
  };
}
