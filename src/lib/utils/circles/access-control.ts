// Circle Access Control Utilities
// Functions to check permissions and access rights for circles
//
// Permission matrix (Member / Contributor / Moderator / Owner):
// - Member:       Access circle; post (if settings allow); comment on + upvote content; vote in polls.
// - Contributor:  Same as Member (reserved for future featured-contributor capabilities).
// - Moderator:    Member capabilities + approve/delete any post or comment, pin/unpin content;
//                 view and remove members (cannot change roles or remove owner/other moderators).
// - Owner:        Full control: circle settings, members, roles, content, events, sessions;
//                 only owner can assign/change roles and change circle settings.
//
// Hi, future you — README sent you here, and honestly this file is the spine of Circles.
// If you only read one thing, make it canAccessCircle: that's where we decide "are you even
// allowed in the room?" (free vs subscription vs paid, blocks, archived circles, the works).
// Posting vs sharing split across canPostInCircle / canShareToCircle; settings can say "only
// mods post" but "everyone shares," so don't assume they're the same — and when you tweak rules,
// give RLS a hug too so app code and the database don't argue in production.
// Most content helpers follow a boring-in-a-good-way pattern: fetch the row, grab circle_id,
// layer owner/author/mod rules. If votes or comments feel wrong, diff your change against RLS.
// Scroll to the bottom for the drama: approval policy, initial approval status, and the
// "did you read the guidelines?" gate — the posts and share routes lean on those hard.
// One gotcha: getCirclesAccessInfo is the fast batch path for lists. It's not a byte-for-byte
// clone of canAccessCircle (lifecycle and blocks don't ride along). That's on purpose until
// someone needs it not to be — just don't copy-paste it into a security-sensitive flow blindly.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { hasActiveSubscription } from '@/lib/utils/tier-access';
import type {
  Circle,
  CircleMembership,
  WhoCanInvite,
  WhoCanPost,
  WhoCanShare,
  CircleContentApprovalStatus,
  CircleSettings,
} from '@/types/circles';

// ============================================================================
// ACCESS CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if a user is the owner of a circle
 */
export async function isCircleOwner(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('circles')
    .select('expert_id')
    .eq('id', circleId)
    .single();
  
  if (error || !data) return false;
  
  return data.expert_id === userId;
}

/**
 * Check if a user is an active member of a circle
 */
export async function isCircleMember(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('circle_memberships')
    .select('id')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  return !error && !!data;
}


/**
 * The front door: can this human actually enter the circle?
 * Tiers, lifecycle, blocks, owner magic — it's all here. A lot of other checks build on top of this,
 * so when something feels "almost right," start your debugging tour here.
 */
export async function canAccessCircle(
  circleId: string,
  userId: string | null
): Promise<boolean> {
  if (!userId) {
    // Only free circles with free content are accessible without login
    return false;
  }
  
  const supabase = await createClient();
  
  // Get circle details
  const { data: circle, error } = await supabase
    .from('circles')
    .select('expert_id, access_type, status')
    .eq('id', circleId)
    .single();
  
  if (error || !circle) return false;
  
  // Circle owner always has access
  if (circle.expert_id === userId) return true;

  // Blocked users cannot access the circle in any lifecycle state.
  if (await isBlockedFromCircle(circleId, userId)) return false;

  const lifecycle = (circle as { status?: string }).status;
  if (lifecycle === 'deleted') return false;
  if (lifecycle === 'archived') {
    return isCircleMember(circleId, userId);
  }
  
  // Free circles: anyone can access
  if (circle.access_type === 'free') return true;
  
  // Subscription-gated: check platform subscription
  if (circle.access_type === 'subscription') {
    return await hasActiveSubscription(userId);
  }
  
  // Paid circles: check circle membership
  if (circle.access_type === 'paid') {
    return await isCircleMember(circleId, userId);
  }
  
  return false;
}

/**
 * Check if a user can post content in a circle
 */
export async function canPostInCircle(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Circle owner can always post
  const owner = await isCircleOwner(circleId, userId);
  if (owner) return true;

  // Load settings to see who is allowed to post
  const { data: circle } = await supabase
    .from('circles')
    .select('settings')
    .eq('id', circleId)
    .single();

  const settings = (circle as { settings?: { who_can_post?: WhoCanPost; allow_member_posts?: boolean } } | null)
    ?.settings;

  // Backwards-compatibility: if who_can_post is not set, fall back to allow_member_posts.
  const whoCanPost: WhoCanPost | undefined = settings?.who_can_post;

  // If neither is configured, default to owner-only (already handled above).
  if (!whoCanPost && !settings?.allow_member_posts) {
    return false;
  }

  // Determine the user's role
  const role = await getUserRoleInCircle(circleId, userId);
  if (!role) return false;

  // Owner already handled; here we consider moderator / contributor / member.
  if (whoCanPost === 'moderators_only') {
    return role === 'moderator';
  }

  // all_members (or legacy allow_member_posts=true) means any active member can post.
  if (whoCanPost === 'all_members' || settings?.allow_member_posts) {
    return role === 'moderator' || role === 'contributor' || role === 'member';
  }

  // owners_only: already covered by owner check; others cannot post.
  return false;
}

/**
 * Alias for canPostInCircle kept for clarity when working specifically
 * with circle \"posts\" (circle_content rows with content_type = 'post').
 * This helps distinguish post-creation checks from other content actions.
 */
export async function canCreateCirclePost(
  circleId: string,
  userId: string
): Promise<boolean> {
  return canPostInCircle(circleId, userId);
}

/**
 * Whether the user may create a Share-to-Circle row in this circle (shared_from set).
 * Mirrors RLS helper circle_shared_content_insert_allowed.
 */
export async function canShareToCircle(circleId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: circle } = await supabase
    .from('circles')
    .select('settings, expert_id')
    .eq('id', circleId)
    .single();

  if (!circle) return false;
  if ((circle as { expert_id: string }).expert_id === userId) return true;

  const settings = (circle as { settings?: CircleSettings }).settings;
  const whoShare: WhoCanShare = settings?.who_can_share ?? 'same_as_post';

  const role = await getUserRoleInCircle(circleId, userId);
  if (!role) return false;

  if (whoShare === 'all_members') {
    return role === 'owner' || role === 'moderator' || role === 'contributor' || role === 'member';
  }

  if (whoShare === 'moderators_only') {
    return role === 'owner' || role === 'moderator';
  }

  return canPostInCircle(circleId, userId);
}

/**
 * Check if a user can view content
 */
export async function canViewContent(
  contentId: string,
  userId: string | null
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: content } = await supabase
    .from('circle_content')
    .select('circle_id, is_free, is_published')
    .eq('id', contentId)
    .single();
  
  if (!content || !content.is_published) return false;
  
  // Free content is accessible to everyone
  if (content.is_free) return true;
  
  // For paid content, check circle access
  if (!userId) return false;
  
  return await canAccessCircle(content.circle_id, userId);
}

/**
 * Check if a user can moderate content in a circle (owner or moderator).
 * Enables approve, delete any content/comment, pin/unpin.
 */
export async function canModerateContent(
  circleId: string,
  userId: string
): Promise<boolean> {
  return await canManageMembers(circleId, userId);
}

/**
 * Check if a user can pin/unpin content in a circle.
 * Requires moderator or owner role.
 */
export async function canPinContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: content } = await supabase
    .from('circle_content')
    .select('circle_id')
    .eq('id', contentId)
    .single();
  if (!content) return false;
  return await canModerateContent(content.circle_id, userId);
}

/**
 * Check if a user can approve content (set is_published = true) in a circle.
 * Requires moderator or owner role.
 */
export async function canApproveContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: content } = await supabase
    .from('circle_content')
    .select('circle_id')
    .eq('id', contentId)
    .single();
  if (!content) return false;
  return await canModerateContent(content.circle_id, userId);
}

/**
 * Check if a user can comment on a piece of content.
 * Any active member (member/contributor/moderator) or owner who can access the
 * circle may comment. Content must be published.
 */
export async function canCommentOnContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: content } = await supabase
    .from('circle_content')
    .select('circle_id, is_published')
    .eq('id', contentId)
    .single();
  if (!content || !content.is_published) return false;
  return await canAccessCircle(content.circle_id, userId);
}

/**
 * Check if a user can upvote/like a piece of content.
 * Same rules as commenting: any user who can access the circle.
 */
export async function canUpvoteContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  return await canCommentOnContent(contentId, userId);
}

/**
 * Vote on published content: must access circle, and content must be approved
 * unless the user is a circle moderator/owner (matches RLS on circle_content_votes).
 */
export async function canVoteOnContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: content } = await supabase
    .from("circle_content")
    .select("circle_id, is_published, approval_status, is_deleted")
    .eq("id", contentId)
    .maybeSingle();
  if (!content || !content.is_published) return false;
  if (content.is_deleted === true && !(await canModerateContent(content.circle_id, userId))) {
    return false;
  }
  if (!(await canAccessCircle(content.circle_id, userId))) return false;
  if (content.approval_status === "approved") return true;
  return await canModerateContent(content.circle_id, userId);
}

/**
 * Vote on a non-deleted comment if the user can vote on its parent content.
 */
export async function canVoteOnComment(
  commentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("circle_comments")
    .select("content_id, is_deleted")
    .eq("id", commentId)
    .maybeSingle();
  if (!row) return false;
  if (row.is_deleted === true) return false;
  return await canVoteOnContent(row.content_id, userId);
}

/**
 * Check if a user can manage circle settings (name, description, access type, etc.).
 * Only the circle owner can change settings.
 */
export async function canManageCircleSettings(
  circleId: string,
  userId: string
): Promise<boolean> {
  return await isCircleOwner(circleId, userId);
}

/**
 * Check if a user can edit content
 */
export async function canEditContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: content } = await supabase
    .from('circle_content')
    .select('author_id, circle_id')
    .eq('id', contentId)
    .single();
  
  if (!content) return false;
  
  // Author can edit their own content
  if (content.author_id === userId) return true;
  
  // Circle owner or moderator can edit any content
  return await canModerateContent(content.circle_id, userId);
}

/**
 * Check if a user can delete content
 */
export async function canDeleteContent(
  contentId: string,
  userId: string
): Promise<boolean> {
  // Same logic as edit
  return await canEditContent(contentId, userId);
}

/**
 * Check if a user can delete any comment (e.g. as moderator)
 * Resolves comment → content → circle, then checks canModerateContent
 */
export async function canDeleteAnyComment(
  commentId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: comment } = await supabase
    .from('circle_comments')
    .select('content_id')
    .eq('id', commentId)
    .single();
  if (!comment) return false;
  const { data: content } = await supabase
    .from('circle_content')
    .select('circle_id')
    .eq('id', comment.content_id)
    .single();
  if (!content) return false;
  return await canModerateContent(content.circle_id, userId);
}

/**
 * Check if a user can manage circle events
 */
export async function canManageEvents(
  circleId: string,
  userId: string
): Promise<boolean> {
  // Only circle owners can manage events
  return await isCircleOwner(circleId, userId);
}

/**
 * Check if a user can register for an event
 */
export async function canRegisterForEvent(
  eventId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: event } = await supabase
    .from('circle_events')
    .select('circle_id, capacity, current_registrations')
    .eq('id', eventId)
    .single();
  
  if (!event) return false;
  
  // Check if user has access to the circle
  const hasAccess = await canAccessCircle(event.circle_id, userId);
  if (!hasAccess) return false;
  
  // Check if event is full
  if (event.capacity && event.current_registrations >= event.capacity) {
    return false;
  }
  
  return true;
}

/**
 * Check if a user can manage circle sessions
 */
export async function canManageSessions(
  circleId: string,
  userId: string
): Promise<boolean> {
  // Only circle owners can manage sessions
  return await isCircleOwner(circleId, userId);
}

/**
 * Check if a user can book a session
 */
export async function canBookSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: session } = await supabase
    .from('circle_sessions')
    .select('circle_id, max_participants, current_bookings, status')
    .eq('id', sessionId)
    .single();
  
  if (!session || session.status !== 'scheduled') return false;
  
  // Check if user has access to the circle
  const hasAccess = await canAccessCircle(session.circle_id, userId);
  if (!hasAccess) return false;
  
  // Check if session is full
  if (session.current_bookings >= session.max_participants) {
    return false;
  }
  
  return true;
}

/**
 * Check if a user is an approved expert
 */
export async function isApprovedExpert(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_expert')
    .eq('id', userId)
    .single();
  
  if (!profile?.is_expert) return false;
  
  const { data: expert } = await supabase
    .from('experts')
    .select('is_approved')
    .eq('user_id', userId)
    .single();
  
  return expert?.is_approved || false;
}

// ============================================================================
// BATCH ACCESS CHECKING (for performance)
// ============================================================================

/**
 * Get access info for multiple circles at once
 */
export async function getCirclesAccessInfo(
  circleIds: string[],
  userId: string | null
): Promise<Record<string, { canAccess: boolean; isMember: boolean; isOwner: boolean }>> {
  if (!userId || circleIds.length === 0) {
    return circleIds.reduce((acc, id) => {
      acc[id] = { canAccess: false, isMember: false, isOwner: false };
      return acc;
    }, {} as Record<string, { canAccess: boolean; isMember: boolean; isOwner: boolean }>);
  }
  
  const supabase = await createClient();
  
  // Get all circles
  const { data: circles } = await supabase
    .from('circles')
    .select('id, expert_id, access_type')
    .in('id', circleIds);
  
  if (!circles) {
    return circleIds.reduce((acc, id) => {
      acc[id] = { canAccess: false, isMember: false, isOwner: false };
      return acc;
    }, {} as Record<string, { canAccess: boolean; isMember: boolean; isOwner: boolean }>);
  }
  
  // Get memberships
  const { data: memberships } = await supabase
    .from('circle_memberships')
    .select('circle_id')
    .in('circle_id', circleIds)
    .eq('user_id', userId)
    .eq('status', 'active');
  
  const membershipSet = new Set(memberships?.map(m => m.circle_id) || []);
  
  // Check subscription status once
  const hasSubscription = await hasActiveSubscription(userId);
  
  // Build access map
  const accessMap: Record<string, { canAccess: boolean; isMember: boolean; isOwner: boolean }> = {};
  
  for (const circle of circles) {
    const isOwner = circle.expert_id === userId;
    const isMember = membershipSet.has(circle.id);
    
    let canAccess = false;
    if (isOwner) {
      canAccess = true;
    } else if (circle.access_type === 'free') {
      canAccess = true;
    } else if (circle.access_type === 'subscription') {
      canAccess = hasSubscription;
    } else if (circle.access_type === 'paid') {
      canAccess = isMember;
    }
    
    accessMap[circle.id] = { canAccess, isMember, isOwner };
  }
  
  return accessMap;
}

// ============================================================================
// MEMBERSHIP MANAGEMENT
// ============================================================================

/**
 * Get user's membership for a circle
 */
export async function getCircleMembership(
  circleId: string,
  userId: string
): Promise<CircleMembership | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('circle_memberships')
    .select('*')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .single();
  
  if (error || !data) return null;
  
  return data as CircleMembership;
}

/**
 * Get all circles a user is a member of
 */
export async function getUserCircles(userId: string): Promise<string[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('circle_memberships')
    .select('circle_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  
  return data?.map(m => m.circle_id) || [];
}

/**
 * Get all circles owned by a user
 */
export async function getOwnedCircles(userId: string): Promise<Circle[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('circles')
    .select('*')
    .eq('expert_id', userId)
    .order('created_at', { ascending: false });
  
  return (data || []) as Circle[];
}

// ============================================================================
// MEMBER MANAGEMENT PERMISSIONS
// ============================================================================

/**
 * Check if a user can manage members (view, approve, remove)
 * Circle owners and moderators can manage members
 */
export async function canManageMembers(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  // Check if user is circle owner
  const { data: circle } = await supabase
    .from('circles')
    .select('expert_id')
    .eq('id', circleId)
    .single();
  
  if (circle?.expert_id === userId) return true;
  
  // Check if user is a moderator
  const { data: membership } = await supabase
    .from('circle_memberships')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  
  return membership?.role === 'moderator';
}

/**
 * Check if a user can manage member roles
 * Only circle owners can manage roles
 */
export async function canManageRoles(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  // Only circle owner can manage roles
  const { data: circle } = await supabase
    .from('circles')
    .select('expert_id')
    .eq('id', circleId)
    .single();
  
  return circle?.expert_id === userId;
}

/**
 * Check if a user can invite members.
 * Respects circle.settings.who_can_invite: owners_only | moderators_only | all_members.
 */
export async function canInviteMembers(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data: circle } = await supabase
    .from('circles')
    .select('expert_id, settings')
    .eq('id', circleId)
    .single();

  if (!circle) return false;

  const ownerId = (circle as { expert_id: string }).expert_id;
  const settings = (circle as { settings?: { who_can_invite?: WhoCanInvite } }).settings;
  const whoCanInvite: WhoCanInvite = settings?.who_can_invite ?? 'moderators_only';

  if (ownerId === userId) return true; // owner can always invite
  if (whoCanInvite === 'owners_only') return false;

  if (whoCanInvite === 'moderators_only') {
    const { data: membership } = await supabase
      .from('circle_memberships')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    return membership?.role === 'moderator';
  }

  // all_members: any active member can invite
  return await isCircleMember(circleId, userId);
}

/**
 * Check if a user can remove a specific member
 * Owners and moderators can remove, but moderators can't remove other moderators or owners
 */
export async function canRemoveMember(
  circleId: string,
  requestingUserId: string,
  targetMemberId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  // Get circle owner
  const { data: circle } = await supabase
    .from('circles')
    .select('expert_id')
    .eq('id', circleId)
    .single();
  
  if (!circle) return false;
  
  // Owner can remove anyone (except themselves)
  if (circle.expert_id === requestingUserId) {
    return targetMemberId !== requestingUserId;
  }
  
  // Check if requester is moderator
  const { data: requesterMembership } = await supabase
    .from('circle_memberships')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', requestingUserId)
    .eq('status', 'active')
    .single();
  
  if (requesterMembership?.role !== 'moderator') return false;
  
  // Get target member role
  const { data: targetMembership } = await supabase
    .from('circle_memberships')
    .select('role, user_id')
    .eq('id', targetMemberId)
    .single();
  
  if (!targetMembership) return false;
  
  // Moderators can't remove the owner or other moderators
  if (targetMembership.user_id === circle.expert_id) return false;
  if (targetMembership.role === 'moderator') return false;
  
  return true;
}

// ============================================================================
// BLOCKING
// ============================================================================

/**
 * Check if a user is blocked from a circle (in circle_blocked_users).
 */
export async function isBlockedFromCircle(
  circleId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('circle_blocked_users')
    .select('id')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .maybeSingle();
  return !error && !!data;
}

/**
 * Owners and active moderators can view the block list and unblock users.
 */
export async function canManageCircleBlockedList(
  circleId: string,
  actorId: string
): Promise<boolean> {
  return await canManageMembers(circleId, actorId);
}

/**
 * Whether the actor may block the given user in this circle.
 * Owner: anyone except the circle owner (cannot block self as owner).
 * Moderator: cannot block the circle owner, another moderator, or themselves.
 */
export async function canBlockTargetUserInCircle(
  circleId: string,
  actorId: string,
  targetUserId: string
): Promise<boolean> {
  if (targetUserId === actorId) return false;

  const supabase = await createClient();
  const { data: circle } = await supabase
    .from('circles')
    .select('expert_id')
    .eq('id', circleId)
    .single();

  if (!circle) return false;

  const expertId = (circle as { expert_id: string }).expert_id;
  if (targetUserId === expertId) return false;

  if (expertId === actorId) return true;

  const { data: actorMembership } = await supabase
    .from('circle_memberships')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', actorId)
    .eq('status', 'active')
    .maybeSingle();

  if (actorMembership?.role !== 'moderator') return false;

  const { data: targetMembership } = await supabase
    .from('circle_memberships')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', targetUserId)
    .eq('status', 'active')
    .maybeSingle();

  if (targetMembership?.role === 'moderator') return false;

  return true;
}

// ============================================================================
// REPORTS
// ============================================================================

/**
 * Check if a user can view and resolve reports for the circle.
 * Owners and moderators can view reports.
 */
export async function canViewReports(
  circleId: string,
  userId: string
): Promise<boolean> {
  return await canManageMembers(circleId, userId);
}

/**
 * Get the user's role in a circle (explicit Supabase client — e.g. service role for cron).
 */
export async function getUserRoleInCircleWithClient(
  supabase: SupabaseClient,
  circleId: string,
  userId: string
): Promise<'owner' | 'moderator' | 'contributor' | 'member' | null> {
  const { data: circle } = await supabase
    .from('circles')
    .select('expert_id')
    .eq('id', circleId)
    .single();

  if (circle?.expert_id === userId) return 'owner';

  const { data: membership } = await supabase
    .from('circle_memberships')
    .select('role')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!membership) return null;

  return membership.role as 'moderator' | 'contributor' | 'member';
}

/**
 * Get the user's role in a circle
 */
export async function getUserRoleInCircle(
  circleId: string,
  userId: string
): Promise<'owner' | 'moderator' | 'contributor' | 'member' | null> {
  const supabase = await createClient();
  return getUserRoleInCircleWithClient(supabase, circleId, userId);
}

// ============================================================================
// APPROVAL WORKFLOW HELPERS
// ============================================================================

/**
 * Returns the circle's posting policy: who_can_post and whether approval is required.
 */
export async function getCirclePostingPolicyWithClient(
  supabase: SupabaseClient,
  circleId: string
): Promise<{
  who_can_post: WhoCanPost;
  requires_approval: boolean;
}> {
  const { data: circle } = await supabase
    .from('circles')
    .select('settings')
    .eq('id', circleId)
    .single();

  const settings = (circle as { settings?: { who_can_post?: WhoCanPost; allow_member_posts?: boolean; requires_approval?: boolean } } | null)?.settings;

  let who_can_post: WhoCanPost = 'owners_only';
  if (settings?.who_can_post) {
    who_can_post = settings.who_can_post;
  } else if (settings?.allow_member_posts) {
    who_can_post = 'all_members';
  }

  const requires_approval = settings?.requires_approval === true;

  return { who_can_post, requires_approval };
}

/**
 * Returns the circle's posting policy: who_can_post and whether approval is required.
 */
export async function getCirclePostingPolicy(circleId: string): Promise<{
  who_can_post: WhoCanPost;
  requires_approval: boolean;
}> {
  const supabase = await createClient();
  return getCirclePostingPolicyWithClient(supabase, circleId);
}

/**
 * Determines the initial approval_status for new content created by userId.
 * - Owners and moderators always get 'approved'.
 * - When requires_approval is true and user is an ordinary member, status = 'pending'.
 * - Otherwise 'approved'.
 */
export async function resolveInitialApprovalStatusWithClient(
  supabase: SupabaseClient,
  circleId: string,
  userId: string
): Promise<CircleContentApprovalStatus> {
  const role = await getUserRoleInCircleWithClient(supabase, circleId, userId);

  if (role === 'owner' || role === 'moderator') return 'approved';

  const { requires_approval } = await getCirclePostingPolicyWithClient(supabase, circleId);
  return requires_approval ? 'pending' : 'approved';
}

/**
 * Determines the initial approval_status for new content created by userId.
 * - Owners and moderators always get 'approved'.
 * - When requires_approval is true and user is an ordinary member, status = 'pending'.
 * - Otherwise 'approved'.
 */
export async function resolveInitialApprovalStatus(
  circleId: string,
  userId: string
): Promise<CircleContentApprovalStatus> {
  const supabase = await createClient();
  return resolveInitialApprovalStatusWithClient(supabase, circleId, userId);
}

/**
 * Returns whether this user must acknowledge latest guidelines before posting.
 */
export async function getGuidelinesAckRequirement(
  circleId: string,
  userId: string
): Promise<{ required: boolean; acknowledged: boolean; required_version: number }> {
  const supabase = await createClient();

  const role = await getUserRoleInCircle(circleId, userId);
  if (role === 'owner' || role === 'moderator') {
    return { required: false, acknowledged: true, required_version: 0 };
  }

  const { data: circle } = await supabase
    .from('circles')
    .select('settings')
    .eq('id', circleId)
    .single();

  const requireAck =
    (circle as { settings?: { require_guidelines_ack?: boolean } } | null)?.settings
      ?.require_guidelines_ack === true;
  if (!requireAck) {
    return { required: false, acknowledged: true, required_version: 0 };
  }

  const { data: welcomePost } = await supabase
    .from('circle_content')
    .select('welcome_version')
    .eq('circle_id', circleId)
    .eq('is_welcome_post', true)
    .eq('approval_status', 'approved')
    .or('is_deleted.eq.false,is_deleted.is.null')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const requiredVersion = Number((welcomePost as { welcome_version?: number } | null)?.welcome_version ?? 0);
  if (requiredVersion === 0) {
    return { required: false, acknowledged: true, required_version: 0 };
  }
  const { data: ack } = await supabase
    .from('circle_guideline_acknowledgments')
    .select('welcome_version')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .maybeSingle();

  const ackVersion = Number((ack as { welcome_version?: number } | null)?.welcome_version ?? 0);
  return {
    required: true,
    acknowledged: ackVersion >= requiredVersion,
    required_version: requiredVersion,
  };
}

