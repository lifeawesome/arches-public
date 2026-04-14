"use client";

import { Globe } from "lucide-react";

interface PublicCircleBadgeProps {
  className?: string;
}

/**
 * Badge to show when a circle is public (visible in directory).
 */
export function PublicCircleBadge({ className = "" }: PublicCircleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ${className}`}
      title="Public Circle"
    >
      <Globe className="h-3 w-3" aria-hidden />
      Public Circle
    </span>
  );
}
