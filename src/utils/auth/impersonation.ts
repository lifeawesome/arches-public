import { cookies } from "next/headers";

/**
 * Cookie names for impersonation state
 */
export const IMPERSONATION_COOKIES = {
  IMPERSONATED_USER_ID: "impersonated_user_id",
  ORIGINAL_ADMIN_ID: "original_admin_id",
  ADMIN_SESSION_BACKUP: "admin_session_backup", // Stores admin's session tokens as JSON
} as const;

/**
 * Impersonation state interface
 */
export interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUserId: string | null;
  originalAdminId: string | null;
}

/**
 * Get impersonation state from cookies (server-side)
 */
export async function getImpersonationState(): Promise<ImpersonationState> {
  const cookieStore = await cookies();
  const impersonatedUserId = cookieStore.get(
    IMPERSONATION_COOKIES.IMPERSONATED_USER_ID
  )?.value;
  const originalAdminId = cookieStore.get(
    IMPERSONATION_COOKIES.ORIGINAL_ADMIN_ID
  )?.value;

  return {
    isImpersonating: !!impersonatedUserId && !!originalAdminId,
    impersonatedUserId: impersonatedUserId || null,
    originalAdminId: originalAdminId || null,
  };
}

/**
 * Check if impersonation is active (server-side)
 */
export async function isImpersonating(): Promise<boolean> {
  const state = await getImpersonationState();
  return state.isImpersonating;
}

/**
 * Get impersonated user ID from cookies (server-side)
 */
export async function getImpersonatedUserId(): Promise<string | null> {
  const state = await getImpersonationState();
  return state.impersonatedUserId;
}

/**
 * Get original admin ID from cookies (server-side)
 */
export async function getOriginalAdminId(): Promise<string | null> {
  const state = await getImpersonationState();
  return state.originalAdminId;
}

/**
 * Client-side helper to check impersonation cookie
 */
export function getImpersonationStateClient(): ImpersonationState {
  if (typeof document === "undefined") {
    return {
      isImpersonating: false,
      impersonatedUserId: null,
      originalAdminId: null,
    };
  }

  const cookies = document.cookie.split(";").reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split("=");
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);

  const impersonatedUserId =
    cookies[IMPERSONATION_COOKIES.IMPERSONATED_USER_ID] || null;
  const originalAdminId =
    cookies[IMPERSONATION_COOKIES.ORIGINAL_ADMIN_ID] || null;

  return {
    isImpersonating: !!impersonatedUserId && !!originalAdminId,
    impersonatedUserId,
    originalAdminId,
  };
}

