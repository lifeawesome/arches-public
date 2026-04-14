"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import type { NotificationEvent } from "@/types/notifications";

export default function MentionsPage() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/user/notification-events?event_type=circle_user_mentioned")
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error((d as { error?: string }).error ?? "Failed to load");
        }
        return res.json() as Promise<{ events: NotificationEvent[] }>;
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Mentions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notifications when someone @mentions you in a circle post or comment.
        </p>

        {loading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {!loading && !error && events.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">No mentions yet.</p>
        )}

        {!loading && !error && events.length > 0 && (
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={e.action_url || "#"}
                  className="block px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{e.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
