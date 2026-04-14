/**
 * Safe token refresh wrapper with exponential backoff and rate limit handling
 * 
 * Wraps Supabase's auto token refresh to:
 * - Coordinate across browser tabs
 * - Implement exponential backoff on failures
 * - Detect and handle rate limits gracefully
 * - Prevent infinite retry loops
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getTokenRefreshCoordinator } from "./token-refresh-coordinator";

interface RefreshState {
  lastAttempt: number;
  attemptCount: number;
  backoffUntil: number;
}

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second
const MAX_BACKOFF = 30000; // 30 seconds
const RATE_LIMIT_BACKOFF = 60000; // 1 minute for rate limits

// Per-client refresh state
const refreshStates = new WeakMap<SupabaseClient, RefreshState>();

/**
 * Get or create refresh state for a client
 */
function getRefreshState(client: SupabaseClient): RefreshState {
  let state = refreshStates.get(client);
  if (!state) {
    state = {
      lastAttempt: 0,
      attemptCount: 0,
      backoffUntil: 0,
    };
    refreshStates.set(client, state);
  }
  return state;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attemptCount: number, isRateLimit: boolean): number {
  if (isRateLimit) {
    return RATE_LIMIT_BACKOFF;
  }
  
  const delay = Math.min(
    INITIAL_BACKOFF * Math.pow(2, attemptCount),
    MAX_BACKOFF
  );
  return delay;
}

/**
 * Check if we should attempt a refresh
 */
function shouldAttemptRefresh(state: RefreshState): boolean {
  const now = Date.now();
  
  // Still in backoff period
  if (now < state.backoffUntil) {
    return false;
  }
  
  // Reset attempt count if enough time has passed
  if (now - state.lastAttempt > 60000) { // 1 minute
    state.attemptCount = 0;
  }
  
  // Too many attempts
  if (state.attemptCount >= MAX_RETRIES) {
    return false;
  }
  
  return true;
}

/**
 * Handle a failed refresh attempt
 */
function handleRefreshFailure(
  client: SupabaseClient,
  error: unknown,
  isRateLimit: boolean
) {
  const state = getRefreshState(client);
  const now = Date.now();
  
  state.lastAttempt = now;
  state.attemptCount += 1;
  
  const backoff = calculateBackoff(state.attemptCount, isRateLimit);
  state.backoffUntil = now + backoff;
  
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[SafeTokenRefresh] Refresh failed (attempt ${state.attemptCount}/${MAX_RETRIES}), backing off for ${backoff}ms`,
      isRateLimit ? '(Rate limited)' : ''
    );
  }
}

/**
 * Handle a successful refresh
 */
function handleRefreshSuccess(client: SupabaseClient) {
  const state = getRefreshState(client);
  state.attemptCount = 0;
  state.backoffUntil = 0;
  state.lastAttempt = Date.now();
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  
  const errorString = String(error);
  return (
    errorString.includes('429') ||
    errorString.toLowerCase().includes('rate limit') ||
    errorString.toLowerCase().includes('too many requests')
  );
}

/**
 * Setup safe token refresh for a Supabase client
 * 
 * This sets up coordination for token refreshes. The actual coordination
 * happens in AuthProvider's onAuthStateChange listener.
 * 
 * Note: Supabase's auto-refresh happens internally, so we coordinate
 * via onAuthStateChange events rather than intercepting refresh calls.
 */
export function setupSafeTokenRefresh(client: SupabaseClient) {
  // The coordination is handled in AuthProvider's onAuthStateChange
  // This function exists for future extensibility if we need to
  // add additional refresh interceptors
  
  // Return cleanup function (no-op for now)
  return () => {
    // Cleanup if needed in the future
  };
}

/**
 * Manually refresh token with coordination and backoff
 */
export async function safeRefreshToken(
  client: SupabaseClient
): Promise<{ success: boolean; error?: unknown }> {
  const coordinator = getTokenRefreshCoordinator();
  const state = getRefreshState(client);
  
  // Check if we should attempt refresh
  if (!shouldAttemptRefresh(state)) {
    return {
      success: false,
      error: new Error('Refresh in backoff period or max retries reached'),
    };
  }
  
  // Request permission to refresh
  const canRefresh = await coordinator.requestRefresh();
  if (!canRefresh) {
    return {
      success: false,
      error: new Error('Another tab is refreshing'),
    };
  }
  
  try {
    // Attempt refresh
    const { data, error } = await client.auth.refreshSession();
    
    if (error) {
      const isRateLimit = isRateLimitError(error);
      handleRefreshFailure(client, error, isRateLimit);
      coordinator.failRefresh(error.message);
      
      return {
        success: false,
        error,
      };
    }
    
    // Success
    handleRefreshSuccess(client);
    coordinator.completeRefresh();
    
    return {
      success: true,
    };
  } catch (error) {
    const isRateLimit = isRateLimitError(error);
    handleRefreshFailure(client, error, isRateLimit);
    coordinator.failRefresh(String(error));
    
    return {
      success: false,
      error,
    };
  }
}

