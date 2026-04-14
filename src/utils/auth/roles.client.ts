"use client";

import { createClient } from "@/utils/supabase/client";

export type UserRole = "admin" | "moderator" | "member";

export interface UserWithRole {
  id: string;
  email?: string;
  role: UserRole;
  full_name?: string;
}

/**
 * Get current user with their role (client-side)
 */
export async function getCurrentUserWithRoleClient(): Promise<UserWithRole | null> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getCurrentUserWithRoleClient] Auth error:", authError?.message);
    }
    return null;
  }

  // Verify session is valid before querying profile
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getCurrentUserWithRoleClient] No valid session:", sessionError?.message);
    }
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[getCurrentUserWithRoleClient] Profile fetch error:",
        profileError.code,
        profileError.message
      );
    }
    return null;
  }

  if (!profile) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[getCurrentUserWithRoleClient] Profile not found for user:", user.id);
    }
    return null;
  }

  const role = (profile.role as UserRole) || "member";
  
  if (process.env.NODE_ENV === "development") {
    console.log("[getCurrentUserWithRoleClient] User role:", role, "for user:", user.id);
  }

  return {
    id: user.id,
    email: user.email,
    role,
    full_name: profile.full_name,
  };
}

/**
 * Check if user is an admin (client-side)
 */
export async function isAdminClient(userId?: string): Promise<boolean> {
  const supabase = createClient();

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
 * Check if user is an admin or moderator (client-side)
 */
export async function isAdminOrModeratorClient(
  userId?: string
): Promise<boolean> {
  const supabase = createClient();

  const id = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!id) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  return data?.role === "admin" || data?.role === "moderator";
}
