// Server-side role utilities
export type UserRole = "admin" | "moderator" | "member";

export interface UserWithRole {
  id: string;
  email?: string;
  role: UserRole;
  full_name?: string;
}

/**
 * Get current user with their role (server-side only)
 * Import dynamically to avoid bundling server code in client
 * When impersonating, returns impersonated user but preserves admin checks via original admin ID
 */
export async function getCurrentUserWithRole(): Promise<UserWithRole | null> {
  const { createClient } = await import("@/utils/supabase/server");
  const { getImpersonationState } = await import("@/utils/auth/impersonation");
  const supabase = await createClient();

  // Check if impersonation is active
  const impersonationState = await getImpersonationState();

  // If impersonating, fetch impersonated user data
  if (impersonationState.isImpersonating && impersonationState.impersonatedUserId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", impersonationState.impersonatedUserId)
      .single();

    if (profileError || !profile) {
      return null;
    }

    return {
      id: profile.id,
      email: profile.email || undefined,
      role: (profile.role as UserRole) || "member",
      full_name: profile.full_name || undefined,
    };
  }

  // Normal flow - get actual authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: (profile.role as UserRole) || "member",
    full_name: profile.full_name,
  };
}

/**
 * Check if user is an admin (server-side only)
 * When impersonating, checks the original admin ID to preserve admin privileges
 */
export async function isAdmin(userId?: string): Promise<boolean> {
  const { createClient } = await import("@/utils/supabase/server");
  const { getImpersonationState } = await import("@/utils/auth/impersonation");
  const supabase = await createClient();

  // Check if impersonation is active
  const impersonationState = await getImpersonationState();
  
  // If impersonating, check the original admin ID
  if (impersonationState.isImpersonating && impersonationState.originalAdminId) {
    const id = userId || impersonationState.originalAdminId;
    if (!id) return false;

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single();

    return data?.role === "admin";
  }

  // Normal flow - check actual user
  const id = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!id) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  return data?.role === "admin";
}

/**
 * Check if user is an admin or moderator (server-side only)
 * When impersonating, checks the original admin ID to preserve admin privileges
 */
export async function isAdminOrModerator(userId?: string): Promise<boolean> {
  const { createClient } = await import("@/utils/supabase/server");
  const { getImpersonationState } = await import("@/utils/auth/impersonation");
  const supabase = await createClient();

  // Check if impersonation is active
  const impersonationState = await getImpersonationState();
  
  // If impersonating, check the original admin ID
  if (impersonationState.isImpersonating && impersonationState.originalAdminId) {
    const id = userId || impersonationState.originalAdminId;
    if (!id) return false;

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .single();

    return data?.role === "admin" || data?.role === "moderator";
  }

  // Normal flow - check actual user
  const id = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!id) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  return data?.role === "admin" || data?.role === "moderator";
}

/**
 * Check if user has required role (server-side only)
 */
export async function hasRole(
  requiredRole: UserRole | UserRole[],
  userId?: string
): Promise<boolean> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();

  const id = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!id) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (!data?.role) return false;

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(data.role as UserRole);
}
