"use client";

import { createClient } from "@/utils/supabase/client";

/**
 * Intelligently resolves avatar URLs from various sources:
 * - Fully qualified URLs (DiceBear, OAuth providers, external URLs) are returned as-is
 * - Relative paths are treated as Supabase storage bucket paths
 *
 * @param path - Avatar URL or path (can be null/undefined)
 * @returns Resolved avatar URL or null if path is empty
 *
 * @example
 * // DiceBear URL - returned as-is
 * getAvatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=Alex")
 *
 * @example
 * // Supabase storage path - constructs full bucket URL
 * getAvatarUrl("user-123-avatar.jpg")
 *
 * @example
 * // OAuth provider URL - returned as-is
 * getAvatarUrl("https://lh3.googleusercontent.com/...")
 */
export function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  // If it's already a full URL (DiceBear, OAuth providers, external URL, or blob URL), return it as-is
  if (path.startsWith("http") || path.startsWith("blob:")) {
    return path;
  }

  // Otherwise, construct the public URL for Supabase storage
  const supabase = createClient();
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Generates initials from a full name for avatar fallbacks
 *
 * @param name - Full name of the user
 * @returns Initials (1-2 characters)
 *
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("Alice") // "AL"
 * getInitials(null) // "U"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}
