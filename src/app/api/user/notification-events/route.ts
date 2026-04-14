import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { NotificationEvent } from "@/types/notifications";

/**
 * GET /api/user/notification-events?event_type=circle_user_mentioned
 * Returns the current user's notification events.
 * Uses the service-role client to bypass RLS so impersonation and session
 * quirks never prevent notifications from being returned.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service-role to bypass RLS — the user is already authenticated above
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("[notification-events] Missing SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json(
        { error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const eventType = request.nextUrl.searchParams.get("event_type");
    let q = adminClient
      .from("notification_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (eventType) {
      q = q.eq("event_type", eventType);
    }

    const { data, error } = await q;

    if (error) {
      console.error("[notification-events] Error:", error);
      return NextResponse.json(
        { error: "Failed to load notifications", details: error.message },
        { status: 500 }
      );
    }

    console.log("[notification-events] user:", user.id, "rows:", data?.length ?? 0);

    return NextResponse.json({
      user_id: process.env.NODE_ENV === "development" ? user.id : undefined,
      events: (data ?? []) as NotificationEvent[],
    });
  } catch (err) {
    console.error("GET /api/user/notification-events:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
