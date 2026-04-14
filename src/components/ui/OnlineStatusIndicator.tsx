"use client";

import { cn } from "@/lib/utils";

interface OnlineStatusIndicatorProps {
  lastSeenAt?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function OnlineStatusIndicator({
  lastSeenAt,
  size = "sm",
  showLabel = false,
  className,
}: OnlineStatusIndicatorProps) {
  // Calculate if user is online (active within last 5 minutes)
  const isOnline = lastSeenAt
    ? new Date().getTime() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000
    : false;

  // Calculate if user was recently active (within last 24 hours)
  const isRecentlyActive = lastSeenAt
    ? new Date().getTime() - new Date(lastSeenAt).getTime() <
      24 * 60 * 60 * 1000
    : false;

  // Don't show anything if user hasn't been seen in 24 hours
  if (!isOnline && !isRecentlyActive) {
    return null;
  }

  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const statusColor = isOnline ? "bg-green-500" : "bg-gray-400";

  const statusLabel = isOnline ? "Online" : "Recently active";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      title={statusLabel}
    >
      <div className="relative">
        <div className={cn("rounded-full", sizeClasses[size], statusColor)} />
        {isOnline && (
          <div
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-75",
              statusColor
            )}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600">{statusLabel}</span>
      )}
    </div>
  );
}
