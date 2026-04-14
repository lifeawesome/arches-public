// Notification preferences types for Arches Network

export type EmailFrequency = "immediate" | "hourly" | "daily" | "weekly";

/**
 * Notification event types (matches database enum)
 */
export type NotificationEventType =
  // Task-related
  | "task_completed"
  | "task_reminder_daily"
  | "task_reminder_afternoon"
  | "task_reminder_evening"
  // Streak-related
  | "streak_milestone"
  | "streak_broken"
  | "streak_warning"
  | "streak_freeze_available"
  // Achievement-related
  | "achievement_unlocked"
  | "level_up"
  | "xp_milestone"
  // Motivational
  | "comeback_reminder"
  | "weekly_summary"
  | "motivational_message"
  // Circle-related
  | "circle_post_created"
  | "circle_comment_created"
  | "circle_post_approved"
  | "circle_post_rejected"
  | "circle_user_mentioned"
  | "circle_member_joined"
  | "circle_role_changed"
  | "circle_reaction_added"
  | "circle_invitation_received"
  | "moderation_report_reviewed";

/**
 * Notification priority levels
 */
export type NotificationPriority = "high" | "normal" | "low";

/**
 * Notification delivery channels
 */
export type NotificationChannel = "in_app" | "email";

/**
 * Notification event metadata types (union of all possible metadata structures)
 */
export type NotificationEventMetadata =
  | TaskCompletedMetadata
  | TaskReminderMetadata
  | StreakMilestoneMetadata
  | StreakBrokenMetadata
  | StreakWarningMetadata
  | StreakFreezeMetadata
  | AchievementUnlockedMetadata
  | LevelUpMetadata
  | XPMilestoneMetadata
  | ComebackReminderMetadata
  | WeeklySummaryMetadata
  | MotivationalMessageMetadata
  | CirclePostCreatedMetadata
  | CircleCommentCreatedMetadata
  | CirclePostApprovalMetadata
  | CircleUserMentionedMetadata
  | CircleMemberJoinedMetadata
  | CircleRoleChangedMetadata
  | CircleReactionAddedMetadata
  | CircleInvitationReceivedMetadata;

/**
 * Task completed notification metadata
 */
export interface TaskCompletedMetadata {
  task_id: string;
  task_title: string;
  pathway_id: string;
  xp_earned: number;
  total_xp: number;
}

/**
 * Task reminder notification metadata
 */
export interface TaskReminderMetadata {
  task_id: string;
  task_title: string;
  pathway_id: string;
  days_pending: number;
}

/**
 * Streak milestone notification metadata
 */
export interface StreakMilestoneMetadata {
  streak_count: number;
  milestone_type: "week" | "month" | "fifty" | "hundred" | "year" | "other";
  milestone_name: string;
}

/**
 * Streak broken notification metadata
 */
export interface StreakBrokenMetadata {
  previous_streak_count: number;
  broken_date: string;
}

/**
 * Streak warning notification metadata
 */
export interface StreakWarningMetadata {
  current_streak: number;
  hours_remaining: number;
}

/**
 * Streak freeze notification metadata
 */
export interface StreakFreezeMetadata {
  streak_count: number;
  freeze_count: number;
}

/**
 * Achievement unlocked notification metadata
 */
export interface AchievementUnlockedMetadata {
  achievement_id: string;
  achievement_name: string;
  achievement_description?: string;
}

/**
 * Level up notification metadata
 */
export interface LevelUpMetadata {
  old_level?: number;
  new_level: number;
  total_xp: number;
}

/**
 * XP milestone notification metadata
 */
export interface XPMilestoneMetadata {
  total_xp: number;
  milestone_xp: number;
}

/**
 * Comeback reminder notification metadata
 */
export interface ComebackReminderMetadata {
  days_inactive: number;
  last_activity_date: string;
}

/**
 * Weekly summary notification metadata
 */
export interface WeeklySummaryMetadata {
  week_start: string;
  week_end: string;
  tasks_completed: number;
  xp_earned: number;
  streak_days: number;
}

/**
 * Motivational message notification metadata
 */
export interface MotivationalMessageMetadata {
  message_type: string;
}

/**
 * Circle post created notification metadata
 */
export interface CirclePostCreatedMetadata {
  circle_id: string;
  circle_name: string;
  content_id: string;
  title: string;
  author_id: string;
}

/**
 * Circle comment created notification metadata
 */
export interface CircleCommentCreatedMetadata {
  circle_id: string;
  circle_name: string;
  content_id: string;
  comment_id: string;
  author_id: string;
}

/**
 * Circle post approval/rejection notification metadata
 */
export interface CirclePostApprovalMetadata {
  circle_id: string;
  circle_name?: string;
  content_id: string;
  approval_status: "approved" | "rejected";
  approved_by: string;
  rejection_reason?: string;
}

/**
 * Circle user mentioned notification metadata
 */
export interface CircleUserMentionedMetadata {
  circle_id: string;
  circle_name: string;
  content_id: string;
  comment_id?: string;
  mentioned_by: string;
  context_excerpt?: string;
}

/**
 * Circle member joined notification metadata
 */
export interface CircleMemberJoinedMetadata {
  circle_id: string;
  circle_name: string;
  member_id: string;
  joined_at: string;
}

/**
 * Circle role changed notification metadata
 */
export interface CircleRoleChangedMetadata {
  circle_id: string;
  circle_name?: string;
  member_id: string;
  old_role: string;
  new_role: string;
  changed_by: string;
}

/**
 * Circle reaction added notification metadata
 */
export interface CircleReactionAddedMetadata {
  circle_id: string;
  circle_name?: string;
  content_id?: string;
  comment_id?: string;
  reacted_by: string;
  reaction_type: string;
}

/**
 * Circle invitation received (existing user invited by email)
 */
export interface CircleInvitationReceivedMetadata {
  circle_id: string;
  circle_name?: string;
  membership_id: string;
  invited_by: string;
  notification_key?: string;
}

/**
 * Notification event (matches notification_events table)
 */
export interface NotificationEvent {
  id: string;
  user_id: string;
  event_type: NotificationEventType;
  title: string;
  message: string;
  metadata: NotificationEventMetadata;
  read_at: string | null;
  action_url: string | null;
  priority: NotificationPriority;
  scheduled_for: string | null;
  channels: NotificationChannel[];
  email_sent_at: string | null;
  email_status: "pending" | "sent" | "delivered" | "failed" | null;
  created_at: string;
}

/**
 * Notification queue item (matches notification_queue table)
 */
export interface NotificationQueueItem {
  id: string;
  user_id: string;
  event_type: NotificationEventType;
  scheduled_for: string;
  metadata: NotificationEventMetadata;
  status: "pending" | "processing" | "sent" | "cancelled";
  created_at: string;
}

/**
 * Core notification preferences stored in user_notification_preferences table
 */
export interface NotificationPreferences {
  user_id: string;
  email_direct_messages: boolean;
  email_project_requests: boolean;
  email_system_notifications: boolean;
  email_frequency: EmailFrequency;
  push_notifications: boolean;
  in_app_notifications?: boolean; // Optional, may be added via migration
  created_at: string;
  updated_at: string;
}

/**
 * Marketing notification preferences stored in marketing_preferences table
 */
export interface MarketingPreferences {
  user_id: string;
  newsletter_subscribed: boolean;
  product_updates_subscribed: boolean;
  event_invitations_subscribed: boolean;
  success_stories_subscribed: boolean;
  partner_offers_subscribed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Unified notification settings for UI consumption
 */
export interface UnifiedNotificationSettings {
  // Core preferences
  email_direct_messages: boolean;
  email_project_requests: boolean;
  email_system_notifications: boolean;
  email_frequency: EmailFrequency;
  push_notifications: boolean;
  in_app_notifications: boolean;
  
  // Marketing preferences
  newsletter_subscribed: boolean;
  product_updates_subscribed: boolean;
  event_invitations_subscribed: boolean;
  success_stories_subscribed: boolean;
  partner_offers_subscribed: boolean;
}

/**
 * Request type for updating notification preferences
 */
export interface UpdateNotificationPreferencesRequest {
  // Core preferences (all optional for partial updates)
  email_direct_messages?: boolean;
  email_project_requests?: boolean;
  email_system_notifications?: boolean;
  email_frequency?: EmailFrequency;
  push_notifications?: boolean;
  in_app_notifications?: boolean;
  
  // Marketing preferences (all optional for partial updates)
  newsletter_subscribed?: boolean;
  product_updates_subscribed?: boolean;
  event_invitations_subscribed?: boolean;
  success_stories_subscribed?: boolean;
  partner_offers_subscribed?: boolean;
}

/**
 * API response type for notification preferences
 */
export interface NotificationPreferencesResponse {
  preferences: UnifiedNotificationSettings;
}

/**
 * Per-circle notification preferences (circle_notification_preferences table)
 */
export interface CircleNotificationPreferences {
  id: string;
  user_id: string;
  circle_id: string;
  notify_posts: boolean;
  notify_comments: boolean;
  notify_mentions: boolean;
  notify_membership: boolean;
  notify_reactions: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request payload for updating per-circle notification preferences
 */
export interface UpdateCircleNotificationPreferencesRequest {
  notify_posts?: boolean;
  notify_comments?: boolean;
  notify_mentions?: boolean;
  notify_membership?: boolean;
  notify_reactions?: boolean;
}

/**
 * Effective notification settings for a specific circle
 * Combines global and per-circle preferences for UI consumption.
 */
export interface CircleNotificationSettingsResponse {
  circle_id: string;
  // Derived from global preferences
  in_app_notifications: boolean;
  email_system_notifications: boolean;
  push_notifications: boolean;
  // Per-circle category toggles
  notify_posts: boolean;
  notify_comments: boolean;
  notify_mentions: boolean;
  notify_membership: boolean;
  notify_reactions: boolean;
}

