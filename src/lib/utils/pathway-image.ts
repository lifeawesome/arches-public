"use client";

import { createClient } from "@/utils/supabase/client";

/**
 * Default pathway placeholder image (SVG data URL with gradient)
 */
const DEFAULT_PATHWAY_IMAGE = "data:image/svg+xml,%3Csvg width='800' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f97316;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23ea580c;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='400' fill='url(%23grad)'/%3E%3Cpath d='M400 200 L450 250 L500 200 L450 150 Z' fill='white' opacity='0.2'/%3E%3C/svg%3E";

/**
 * Intelligently resolves pathway cover image URLs from various sources:
 * - Fully qualified URLs (external URLs) are returned as-is
 * - Relative paths are treated as Supabase storage bucket paths
 * - Returns a default placeholder image if path is empty
 *
 * @param path - Pathway cover image URL or path (can be null/undefined)
 * @returns Resolved pathway image URL or default placeholder if path is empty
 *
 * @example
 * // External URL - returned as-is
 * getPathwayImageUrl("https://example.com/image.jpg")
 *
 * @example
 * // Supabase storage path - constructs full bucket URL
 * getPathwayImageUrl("pathway-images/building-personal-brand.jpg")
 *
 * @example
 * // No image - returns default placeholder
 * getPathwayImageUrl(null) // Returns default gradient image
 */
export function getPathwayImageUrl(path: string | null | undefined): string {
  if (!path) return DEFAULT_PATHWAY_IMAGE;

  // If it's already a full URL (external URL or blob URL), return it as-is
  if (path.startsWith("http") || path.startsWith("blob:")) {
    return path;
  }

  // Otherwise, construct the public URL for Supabase storage
  const supabase = createClient();
  const { data } = supabase.storage.from("pathway-images").getPublicUrl(path);

  return data.publicUrl;
}

