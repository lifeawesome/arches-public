/**
 * In-memory rate limits for vote mutations and batch vote reads (per user).
 * Best-effort; resets on cold starts (same pattern as invitation-rate-limit).
 */

const MUTATION_WINDOW_MS = 60 * 1000;
const MUTATION_MAX_PER_WINDOW = 90;

const BATCH_WINDOW_MS = 60 * 1000;
const BATCH_MAX_PER_WINDOW = 120;

type Entry = { count: number; windowStart: number };

const mutationCounts = new Map<string, Entry>();
const batchCounts = new Map<string, Entry>();

function tick(
  map: Map<string, Entry>,
  key: string,
  windowMs: number,
  maxPerWindow: number
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry) {
    map.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (now - entry.windowStart >= windowMs) {
    entry = { count: 1, windowStart: now };
    map.set(key, entry);
    return { allowed: true };
  }
  if (entry.count >= maxPerWindow) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  entry.count += 1;
  map.set(key, entry);
  return { allowed: true };
}

export function checkVoteMutationRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  return tick(mutationCounts, userId, MUTATION_WINDOW_MS, MUTATION_MAX_PER_WINDOW);
}

export function checkVoteBatchRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  return tick(batchCounts, userId, BATCH_WINDOW_MS, BATCH_MAX_PER_WINDOW);
}
