/**
 * In-memory rate limit for circle lifecycle actions.
 * Per user per circle: max 6 lifecycle actions per 10 minutes.
 */

const LIFECYCLE_WINDOW_MS = 10 * 60 * 1000;
const LIFECYCLE_MAX_PER_WINDOW = 6;

type Entry = { count: number; windowStart: number };

const lifecycleCounts = new Map<string, Entry>(); // key: `${userId}:${circleId}`

function prune(entry: Entry): Entry {
  const now = Date.now();
  if (now - entry.windowStart >= LIFECYCLE_WINDOW_MS) {
    return { count: 1, windowStart: now };
  }
  return entry;
}

export function checkLifecycleRateLimit(
  userId: string,
  circleId: string
): { allowed: boolean; retryAfterSeconds?: number } {
  const key = `${userId}:${circleId}`;
  const now = Date.now();
  let entry = lifecycleCounts.get(key);
  if (!entry) {
    lifecycleCounts.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  entry = prune(entry);
  if (entry.count >= LIFECYCLE_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + LIFECYCLE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  entry.count += 1;
  lifecycleCounts.set(key, entry);
  return { allowed: true };
}
