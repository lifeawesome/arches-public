import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type {
  UpdateCircleNotificationPreferencesRequest,
  CircleNotificationSettingsResponse,
} from "@/types/notifications";
import { getCircleNotificationSettings } from "@/lib/dashboard/queries";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/notifications
 * Returns effective notification settings for the current user in the circle.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure circle exists (and user can at least see it)
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single();

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const [{ data: globalPrefs }, { data: circlePrefs }] = await Promise.all([
      supabase
        .from("user_notification_preferences")
        .select(
          "in_app_notifications, email_system_notifications, push_notifications"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("circle_notification_preferences")
        .select(
          "notify_posts, notify_comments, notify_mentions, notify_membership, notify_reactions"
        )
        .eq("user_id", user.id)
        .eq("circle_id", circleId)
        .maybeSingle(),
    ]);

    if (!globalPrefs) {
      // If global prefs don't exist yet, fall back to sensible defaults
      const effective: CircleNotificationSettingsResponse = {
        circle_id: circleId,
        in_app_notifications: true,
        email_system_notifications: false,
        push_notifications: false,
        notify_posts: true,
        notify_comments: true,
        notify_mentions: true,
        notify_membership: false,
        notify_reactions: false,
      };
      return NextResponse.json({ settings: effective });
    }

    return NextResponse.json({
      settings: {
        circle_id: circleId,
        in_app_notifications:
          globalPrefs.in_app_notifications ?? true,
        email_system_notifications:
          globalPrefs.email_system_notifications ?? false,
        push_notifications: globalPrefs.push_notifications ?? false,
        notify_posts: circlePrefs?.notify_posts ?? true,
        notify_comments: circlePrefs?.notify_comments ?? true,
        notify_mentions: circlePrefs?.notify_mentions ?? true,
        notify_membership: circlePrefs?.notify_membership ?? false,
        notify_reactions: circlePrefs?.notify_reactions ?? false,
      },
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/notifications:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/circles/[id]/notifications
 * Upserts per-circle notification preferences for the current user.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as UpdateCircleNotificationPreferencesRequest;

    const upsertPayload = {
      user_id: user.id,
      circle_id: circleId,
      ...body,
    };

    const { data, error } = await supabase
      .from("circle_notification_preferences")
      .upsert(upsertPayload, {
        onConflict: "user_id,circle_id",
      })
      .select()
      .single();

    if (error) {
      console.error("Error updating circle notification prefs:", error);
      return NextResponse.json(
        { error: "Failed to update circle notification preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences: data });
  } catch (err) {
    console.error("PATCH /api/circles/[id]/notifications:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
