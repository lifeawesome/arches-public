"use client";

import type { NotificationEvent } from "@/types/notifications";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NotificationPanelProps {
  notifications: NotificationEvent[];
  unreadCount: number;
  isLoading?: boolean;
  circleNameById?: Record<string, string>;
}

function formatTimeAgo(timestamp: string | null | undefined): string {
  if (!timestamp) return "Just now";
  
  const now = new Date();
  const time = new Date(timestamp);
  
  // Check if date is valid
  if (isNaN(time.getTime())) {
    return "Just now";
  }
  
  const diff = now.getTime() - time.getTime();
  
  // Handle future dates or invalid differences
  if (isNaN(diff) || diff < 0) {
    return "Just now";
  }
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationPanel({
  notifications,
  unreadCount,
  isLoading = false,
  circleNameById = {},
}: NotificationPanelProps) {
  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/mentions"
            className="text-xs text-primary underline-offset-4 hover:underline"
            onClick={(ev) => ev.stopPropagation()}
          >
            Mentions
          </Link>
          {unreadCount > 0 && !isLoading && (
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6">
              <p className="text-sm font-medium text-foreground">
                No notifications yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You'll see notifications here when you have updates.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.action_url || "#"}
                className={cn(
                  "block px-4 py-3 transition-colors hover:bg-accent/50",
                  !notification.read_at && "bg-accent/30"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread indicator */}
                  {!notification.read_at && (
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  {notification.read_at && (
                    <div className="mt-1.5 h-2 w-2 shrink-0" />
                  )}

                  {/* Notification content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {notification.event_type === "circle_post_created"
                            ? `New post in ${circleNameById[(notification.metadata as { circle_id?: string })?.circle_id ?? ""] || "a circle"}`
                            : notification.event_type === "circle_user_mentioned"
                              ? `Mention in ${circleNameById[(notification.metadata as { circle_id?: string })?.circle_id ?? ""] || "a circle"}`
                              : notification.event_type === "circle_invitation_received"
                                ? `Invitation to ${circleNameById[(notification.metadata as { circle_id?: string })?.circle_id ?? ""] || (notification.metadata as { circle_name?: string })?.circle_name || "a circle"}`
                                : notification.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                          {notification.event_type === "circle_post_created"
                            ? (notification.metadata as { title?: string })?.title || notification.message
                            : notification.event_type === "circle_user_mentioned"
                              ? notification.message
                              : notification.message}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

