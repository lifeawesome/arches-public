// Circle Types
// TypeScript definitions for the Community Circle feature

// ============================================================================
// ENUMS
// ============================================================================

export type CircleAccessType = 'free' | 'subscription' | 'paid';
export type CircleVisibility = 'public' | 'private';
/** Issue #138: directory/joins only when active; archived = hidden, members retain access; deleted = owner-only */
export type CircleLifecycleStatus = 'active' | 'archived' | 'deleted';
export type CircleMembershipStatus = 'pending' | 'active' | 'expired' | 'cancelled';
export type CircleContentType = 'post' | 'article' | 'resource' | 'announcement' | 'poll';
export type CircleEventType = 'online' | 'in_person' | 'hybrid';
export type CircleSessionType = 'office_hours' | 'coaching' | 'group_session';
export type CircleRegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'waitlist';
export type CircleBookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// ============================================================================
// CIRCLE CATEGORY (admin-manageable)
// ============================================================================

export interface CircleCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CIRCLE SETTINGS
// ============================================================================

export type WhoCanInvite = 'all_members' | 'moderators_only' | 'owners_only';
export type WhoCanPost = 'owners_only' | 'moderators_only' | 'all_members';
/** Who may use Share-to-Circle into this circle. Defaults to same_as_post when unset. */
export type WhoCanShare = 'same_as_post' | 'all_members' | 'moderators_only';

/** Moderation state for a piece of circle content */
export type CircleContentApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Lifecycle for feed visibility (issue #137); distinct from approval_status */
export type CircleContentPublicationStatus = 'draft' | 'scheduled' | 'published';

export interface CircleSettings {
  allow_member_posts: boolean;
  auto_approve_members: boolean;
  show_member_list: boolean;
  require_introduction: boolean;
  who_can_invite?: WhoCanInvite;
  who_can_post?: WhoCanPost;
  who_can_share?: WhoCanShare;
  /**
   * When true and who_can_post = 'all_members', member posts are created as
   * 'pending' and must be approved by a moderator/owner before appearing in the feed.
   */
  requires_approval?: boolean;
  /** Optional guidelines / welcome message (markdown) shown at top of circle feed. */
  guidelines_markdown?: string;
  /** Require members to acknowledge latest welcome/guidelines before posting. */
  require_guidelines_ack?: boolean;
}

// ============================================================================
// SHARE TO CIRCLE
// ============================================================================

export type LinkPreviewSnapshot = {
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
};

export type SharedFromCircleContent = {
  kind: 'circle_content';
  content_id: string;
  circle_id: string;
  circle_slug?: string;
  circle_name?: string;
  title_snapshot?: string;
};

export type SharedFromUrl = {
  kind: 'url';
  url: string;
  preview?: LinkPreviewSnapshot;
};

export type SharedFromPayload = SharedFromCircleContent | SharedFromUrl;

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface Circle {
  id: string;
  expert_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  
  // Directory and visibility
  visibility: CircleVisibility;
  category_id: string | null;
  is_featured: boolean;
  
  // Access control
  access_type: CircleAccessType;
  price_cents: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  
  // Status and metrics
  is_active: boolean;
  /** Lifecycle state; is_active is derived in DB from status = active */
  status: CircleLifecycleStatus;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  member_count: number;
  
  // Settings
  settings: CircleSettings;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CircleMembership {
  id: string;
  circle_id: string;
  user_id: string | null; // null for pending invitation rows (invited by email)

  // Membership details
  membership_type: string;
  status: CircleMembershipStatus;
  stripe_subscription_id: string | null;

  // Invitation tracking
  invitation_accepted_at?: string | null;
  invitation_expires_at?: string | null;
  invited_email?: string | null;

  // Timestamps
  joined_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CircleContent {
  id: string;
  circle_id: string;
  author_id: string;
  
  // Content details
  title: string;
  content: string;
  content_type: CircleContentType;
  
  // Access control
  is_free: boolean;
  is_published: boolean;
  is_pinned: boolean;
  is_welcome_post?: boolean;
  welcome_version?: number;
  
  // Moderation / approval
  approval_status: CircleContentApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;

  /** draft / scheduled / published — feed shows only published + approved */
  publication_status: CircleContentPublicationStatus;
  /** Set when publication_status is scheduled; cleared when published */
  scheduled_for: string | null;
  
  // Soft delete
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  
  // Engagement metrics
  view_count: number;
  like_count: number;
  /** Downvotes; triggers keep in sync with circle_content_votes. */
  downvote_count: number;
  comment_count: number;
  
  // Timestamps
  published_at: string | null;
  created_at: string;
  updated_at: string;

  /** Present when this row is a share (see shared_by). */
  shared_from?: SharedFromPayload | null;
  shared_by?: string | null;
}

/** Resolved @mention on circle post or comment (see circle_mentions). */
export interface CircleMention {
  id: string;
  circle_id: string;
  content_id: string | null;
  comment_id: string | null;
  mentioned_user_id: string;
  mentioned_by: string;
  created_at: string;
}

export interface CircleComment {
  id: string;
  content_id: string;
  user_id: string;
  
  // Comment details
  comment_text: string;
  parent_comment_id: string | null;
  
  // Soft delete
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  
  // Engagement
  like_count: number;
  downvote_count: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/** User vote direction on content or comments (DB enum circle_vote_type). */
export type CircleVoteType = "up" | "down";

// ============================================================================
// BLOCKING, REPORTS, MODERATION ACTIVITY
// ============================================================================

export interface CircleBlockedUser {
  id: string;
  circle_id: string;
  user_id: string;
  blocked_by: string;
  created_at: string;
}

export type CircleReportStatus = 'pending' | 'resolved' | 'dismissed';

export type CircleReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'copyright'
  | 'other';

export interface CircleReport {
  id: string;
  circle_id: string;
  reporter_id: string;
  reported_content_id: string | null;
  reported_comment_id: string | null;
  reason: CircleReportReason;
  description: string | null;
  reason_text: string | null;
  status: CircleReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type CircleModerationAction =
  | 'content_soft_deleted'
  | 'comment_soft_deleted'
  | 'user_blocked'
  | 'user_unblocked'
  | 'report_resolved'
  | 'report_dismissed'
  | 'content_pinned'
  | 'content_unpinned'
  | 'content_approved'
  | 'content_rejected'
  | 'circle_archived'
  | 'circle_unarchived'
  | 'circle_deleted';

export type CircleModerationTargetType = 'content' | 'comment' | 'user' | 'report' | 'circle';

export interface CircleModerationActivityEntry {
  id: string;
  circle_id: string;
  actor_id: string;
  action: CircleModerationAction;
  target_type: CircleModerationTargetType;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CircleEventLocationDetails {
  venue?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  meeting_link?: string;
  meeting_password?: string;
  instructions?: string;
}

export interface CircleEvent {
  id: string;
  circle_id: string;
  
  // Event details
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  
  // Location
  event_type: CircleEventType;
  location_details: CircleEventLocationDetails;
  
  // Capacity
  capacity: number | null;
  current_registrations: number;
  waitlist_enabled: boolean;
  
  // Pricing
  is_free: boolean;
  price_cents: number | null;
  
  // Additional info
  registration_url: string | null;
  cover_image_url: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CircleEventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  
  // Registration details
  status: CircleRegistrationStatus;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  
  // Additional info
  notes: string | null;
  
  // Timestamps
  registered_at: string;
  created_at: string;
  updated_at: string;
}

export interface CircleSession {
  id: string;
  circle_id: string;
  host_id: string;
  
  // Session details
  title: string;
  description: string | null;
  session_type: CircleSessionType;
  
  // Schedule
  start_time: string;
  duration_minutes: number;
  timezone: string;
  
  // Capacity
  max_participants: number;
  current_bookings: number;
  
  // Pricing
  price_cents: number;
  
  // Meeting details
  meeting_link: string | null;
  meeting_password: string | null;
  
  // Status
  status: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CircleSessionBooking {
  id: string;
  session_id: string;
  user_id: string;
  
  // Booking details
  status: CircleBookingStatus;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  
  // Additional info
  notes: string | null;
  
  // Timestamps
  booked_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EXTENDED TYPES (with relations)
// ============================================================================

export interface CircleWithExpert extends Circle {
  expert: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    expertise: string | null;
  };
}

/** Directory list item: circle with expert, category, and aggregated stats */
export interface CircleDirectoryItem extends CircleWithExpert {
  category: CircleCategory | null;
  post_count: number;
  total_view_count: number;
  total_like_count: number;
}

// ============================================================================
// CIRCLE ANALYTICS (owner dashboard; issue #129)
// ============================================================================

/** Per–content row for tables, CSV export, and top-content lists */
export interface CircleAnalyticsContentRow {
  id: string;
  title: string;
  content_type: CircleContentType;
  approval_status: CircleContentApprovalStatus;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  created_at: string;
}

/** Rollups for feed-like content (posts + polls), optionally filtered by time window */
export interface CircleAnalyticsSummary {
  circle_id: string;
  circle_name: string;
  member_count: number;
  /** Count of non-deleted content rows included in engagement totals (posts + polls only) */
  content_items_count: number;
  totals: {
    view_count: number;
    like_count: number;
    comment_count: number;
  };
  by_approval: {
    approved: number;
    pending: number;
    rejected: number;
  };
  /** Top pieces by views (same filter as totals) */
  top_by_views: CircleAnalyticsContentRow[];
  /** Optional ISO range echoed when `from` / `to` query params were applied */
  window: { from: string | null; to: string | null };
  generated_at: string;
}

/** Lightweight comparison across other circles owned by the same expert */
export interface CircleAnalyticsPeerSummary {
  circle_id: string;
  name: string;
  slug: string;
  member_count: number;
  totals: {
    view_count: number;
    like_count: number;
    comment_count: number;
  };
  content_items_count: number;
}

export interface CircleAnalyticsResponse {
  analytics: CircleAnalyticsSummary;
  /** Present when `include_peers=1` and the expert owns more than one circle */
  peer_circles?: CircleAnalyticsPeerSummary[];
}

export interface CircleWithMembership extends Circle {
  membership: CircleMembership | null;
  expert: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface CircleContentWithAuthor extends CircleContent {
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  /** Profile for shared_by when set (usually same as author for shares). */
  sharer?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

// ============================================================================
// POLLS
// ============================================================================

export interface CirclePoll {
  id: string;
  circle_id: string;
  content_id: string;
  question: string; // Markdown
  options: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CirclePollResultRow {
  option_index: number;
  vote_count: number;
}

export interface CirclePollWithResults extends CirclePoll {
  results: CirclePollResultRow[];
}

export type CircleFeedItem = (CircleContentWithAuthor & { poll?: CirclePollWithResults }) & (
  | { content_type: Exclude<CircleContentType, 'poll'>; poll?: never }
  | { content_type: 'poll'; poll: CirclePollWithResults }
);

export interface CircleCommentWithAuthor extends CircleComment {
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  replies?: CircleCommentWithAuthor[];
}

/** Comment row from GET .../comments with joined author (API). */
export interface CircleCommentApiRow extends CircleComment {
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface CircleEventWithRegistration extends CircleEvent {
  registration: CircleEventRegistration | null;
  circle: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CircleSessionWithBooking extends CircleSession {
  booking: CircleSessionBooking | null;
  host: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface CreateCircleInput {
  name: string;
  slug: string;
  description: string;
  cover_image_url?: string;
  visibility?: CircleVisibility;
  category_id?: string | null;
  access_type: CircleAccessType;
  price_cents?: number;
  settings?: Partial<CircleSettings>;
}

export interface UpdateCircleInput {
  name?: string;
  description?: string;
  cover_image_url?: string;
  visibility?: CircleVisibility;
  category_id?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  access_type?: CircleAccessType;
  price_cents?: number;
  settings?: Partial<CircleSettings>;
}

export interface CreateContentInput {
  circle_id: string;
  title: string;
  content: string;
  content_type: CircleContentType;
  is_free?: boolean;
  is_published?: boolean;
  is_pinned?: boolean;
}

export interface UpdateContentInput {
  title?: string;
  content?: string;
  content_type?: CircleContentType;
  is_free?: boolean;
  is_published?: boolean;
  is_pinned?: boolean;
}

export interface CreateEventInput {
  circle_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone: string;
  event_type: CircleEventType;
  location_details?: CircleEventLocationDetails;
  capacity?: number;
  waitlist_enabled?: boolean;
  is_free?: boolean;
  price_cents?: number;
  registration_url?: string;
  cover_image_url?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  event_type?: CircleEventType;
  location_details?: CircleEventLocationDetails;
  capacity?: number;
  waitlist_enabled?: boolean;
  is_free?: boolean;
  price_cents?: number;
  registration_url?: string;
  cover_image_url?: string;
}

export interface CreateSessionInput {
  circle_id: string;
  title: string;
  description?: string;
  session_type: CircleSessionType;
  start_time: string;
  duration_minutes: number;
  timezone: string;
  max_participants: number;
  price_cents?: number;
  meeting_link?: string;
  meeting_password?: string;
}

export interface UpdateSessionInput {
  title?: string;
  description?: string;
  session_type?: CircleSessionType;
  start_time?: string;
  duration_minutes?: number;
  timezone?: string;
  max_participants?: number;
  price_cents?: number;
  meeting_link?: string;
  meeting_password?: string;
  status?: string;
}

export interface JoinCircleInput {
  circle_id: string;
  payment_method_id?: string; // For paid circles
}

export interface RegisterForEventInput {
  event_id: string;
  notes?: string;
  payment_method_id?: string; // For paid events
}

export interface BookSessionInput {
  session_id: string;
  notes?: string;
  payment_method_id?: string; // For paid sessions
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface CirclesListResponse {
  circles: CircleWithExpert[];
  total: number;
  page: number;
  per_page: number;
}

export interface CircleDirectoryResponse {
  circles: CircleDirectoryItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface CircleSearchResult extends CircleDirectoryItem {
  score: number;
}

export interface CircleSearchResponse {
  results: CircleSearchResult[];
  total: number;
  page: number;
  per_page: number;
}

export interface CircleSearchSuggestion {
  id: string;
  name: string;
  slug: string;
  visibility: CircleVisibility;
  member_count: number;
  category: { id: string; name: string; slug: string } | null;
}

export interface CircleSearchSuggestionsResponse {
  suggestions: CircleSearchSuggestion[];
}

export interface CircleDetailResponse {
  circle: CircleWithMembership;
  is_owner: boolean;
  is_member: boolean;
  can_post: boolean;
}

export interface CircleContentListResponse {
  content: CircleContentWithAuthor[];
  welcome_post?: CircleContentWithAuthor | null;
  total: number;
  page: number;
  per_page: number;
}

export interface CircleEventsListResponse {
  events: CircleEventWithRegistration[];
  total: number;
}

export interface CircleSessionsListResponse {
  sessions: CircleSessionWithBooking[];
  total: number;
}

export interface CircleMembersListResponse {
  members: Array<{
    id: string;
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    joined_at: string;
    membership_type: string;
  }>;
  total: number;
}

export interface CircleAnalytics {
  member_count: number;
  member_growth: number; // percentage change
  content_count: number;
  engagement_rate: number; // percentage
  event_count: number;
  session_count: number;
  revenue: number; // in cents
  recent_activity: Array<{
    type: 'member_joined' | 'content_posted' | 'event_created' | 'session_booked';
    timestamp: string;
    details: string;
  }>;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface CircleFilters {
  access_type?: CircleAccessType;
  expert_id?: string;
  search?: string;
  is_active?: boolean;
}

export interface CircleContentFilters {
  content_type?: CircleContentType;
  author_id?: string;
  is_pinned?: boolean;
  is_free?: boolean;
}

export interface CircleEventFilters {
  event_type?: CircleEventType;
  start_date?: string;
  end_date?: string;
  is_free?: boolean;
}

export interface CircleSessionFilters {
  session_type?: CircleSessionType;
  host_id?: string;
  start_date?: string;
  end_date?: string;
  available_only?: boolean;
}

// ============================================================================
// MEMBER MANAGEMENT TYPES
// ============================================================================

export type CircleMemberRole = 'member' | 'contributor' | 'moderator';

export interface CircleMemberActivity {
  content_count: number;
  comment_count: number;
  event_attendance_count: number;
  last_content_at?: string;
  last_comment_at?: string;
}

export interface CircleMemberWithProfile {
  id: string;
  circle_id: string;
  user_id: string | null; // null for pending invitation
  role: CircleMemberRole;
  membership_type: 'free' | 'paid';
  status: CircleMembershipStatus;
  joined_at: string;
  invited_by?: string;
  invitation_token?: string;
  invitation_sent_at?: string;
  invitation_accepted_at?: string | null;
  invitation_expires_at?: string | null;
  invited_email?: string | null;
  notes?: string;
  // Joined profile data (empty for pending when user_id is null)
  profile: {
    id: string;
    full_name: string;
    avatar_url?: string;
    expertise?: string;
  };
  // Activity stats
  activity?: CircleMemberActivity;
}

export interface InviteMemberInput {
  email?: string;
  emails?: string[]; // bulk invite
  user_id?: string;
  role?: CircleMemberRole;
  message?: string;
  expires_in_days?: number;
}

export interface BulkMemberAction {
  member_ids: string[];
  action: 'approve' | 'reject' | 'remove' | 'update_role';
  role?: CircleMemberRole;
}

export interface UpdateMemberInput {
  role?: CircleMemberRole;
  status?: CircleMembershipStatus;
  notes?: string;
}

export interface MembersListResponse {
  members: CircleMemberWithProfile[];
  total: number;
  page: number;
  per_page: number;
}

export interface MemberFilters {
  status?: CircleMembershipStatus;
  role?: CircleMemberRole;
  search?: string;
}

export type CircleInvitationAuditAction =
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_resent'
  | 'invitation_revoked';

export interface CircleInvitationAuditLogEntry {
  id: string;
  circle_id: string;
  membership_id: string;
  action: CircleInvitationAuditAction;
  performed_by: string;
  invited_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PendingInvitation {
  id: string;
  circle_id: string;
  invited_email: string;
  role: CircleMemberRole;
  invited_by: string;
  invitation_sent_at: string;
  invitation_expires_at: string | null;
}

