/**
 * In-memory rate limit for circle invitations (create and resend).
 * Per user per circle: max 10 invites per 10 minutes; per membership: max 5 resends per hour.
 */

const INVITE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const INVITE_MAX_PER_WINDOW = 10;
const RESEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RESEND_MAX_PER_WINDOW = 5;

type Entry = { count: number; windowStart: number };

const inviteCounts = new Map<string, Entry>(); // key: `${userId}:${circleId}`
const resendCounts = new Map<string, Entry>(); // key: `${userId}:${membershipId}`

function prune(entry: Entry, windowMs: number): Entry {
  const now = Date.now();
  if (now - entry.windowStart >= windowMs) {
    return { count: 1, windowStart: now };
  }
  return entry;
}

export function checkInviteRateLimit(userId: string, circleId: string): { allowed: boolean; retryAfterSeconds?: number } {
  const key = `${userId}:${circleId}`;
  const now = Date.now();
  let entry = inviteCounts.get(key);
  if (!entry) {
    inviteCounts.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  entry = prune(entry, INVITE_WINDOW_MS);
  if (entry.count >= INVITE_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + INVITE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  entry.count += 1;
  inviteCounts.set(key, entry);
  return { allowed: true };
}

export function checkResendRateLimit(userId: string, membershipId: string): { allowed: boolean; retryAfterSeconds?: number } {
  const key = `${userId}:${membershipId}`;
  const now = Date.now();
  let entry = resendCounts.get(key);
  if (!entry) {
    resendCounts.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  entry = prune(entry, RESEND_WINDOW_MS);
  if (entry.count >= RESEND_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + RESEND_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  entry.count += 1;
  resendCounts.set(key, entry);
  return { allowed: true };
}
