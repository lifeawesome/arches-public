"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatarUrl, getInitials } from "@/utils/avatar";
import { cn } from "@/lib/utils";

export interface SmartAvatarProps {
  /** Avatar URL or Supabase storage path */
  src?: string | null;
  /** Alt text for the avatar image */
  alt: string;
  /** Fallback content (defaults to initials from alt) */
  fallback?: React.ReactNode;
  /** Size of the avatar in pixels (default: 40) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SmartAvatar - Intelligently handles avatar URLs from multiple sources
 *
 * Automatically detects and handles:
 * - DiceBear avatars (https://api.dicebear.com/...)
 * - OAuth provider avatars (Google, GitHub, etc.)
 * - Supabase storage bucket paths
 * - External URLs
 *
 * Features:
 * - Next.js Image optimization
 * - Automatic fallback to initials
 * - Configurable size
 *
 * @example
 * <SmartAvatar
 *   src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
 *   alt="Alex Smith"
 *   size={48}
 * />
 *
 * @example
 * <SmartAvatar
 *   src="user-avatar.jpg"
 *   alt="John Doe"
 *   fallback={<UserIcon />}
 * />
 */
export function SmartAvatar({
  src,
  alt,
  fallback,
  size = 40,
  className,
}: SmartAvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const url = getAvatarUrl(src);
    setResolvedUrl(url);
    setImageError(false); // Reset error state when src changes
  }, [src]);

  // Determine fallback content
  const fallbackContent = fallback ?? getInitials(alt);

  // Check if the image is an SVG (DiceBear, SVG uploads, etc.)
  const isSvg = (url: string): boolean => {
    const urlLower = url.toLowerCase();
    // Check for .svg extension or /svg in path (DiceBear) or svg in query/path
    return (
      urlLower.includes(".svg") ||
      urlLower.includes("/svg") ||
      url.includes("dicebear.com")
    );
  };

  // Check if URL is from local development (127.0.0.1 or localhost)
  const isLocalDev = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === "127.0.0.1" ||
        urlObj.hostname === "localhost" ||
        urlObj.hostname.startsWith("127.0.0.1")
      );
    } catch {
      return false;
    }
  };

  return (
    <Avatar
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      {resolvedUrl && !imageError ? (
        <div className="relative w-full h-full overflow-hidden rounded-full">
          <Image
            src={resolvedUrl}
            alt={alt}
            fill
            className="object-cover"
            sizes={`${size}px`}
            onError={() => setImageError(true)}
            unoptimized={isSvg(resolvedUrl) || isLocalDev(resolvedUrl)} // Don't optimize SVGs or local dev URLs (avoids private IP blocking)
          />
        </div>
      ) : (
        <AvatarFallback className="text-white bg-gradient-to-br from-orange-400 to-orange-600">
          {fallbackContent}
        </AvatarFallback>
      )}
    </Avatar>
  );
}

export default SmartAvatar;
