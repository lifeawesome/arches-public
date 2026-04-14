import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canManageCircleBlockedList } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

/**
 * DELETE /api/circles/[id]/blocked/[userId]
 * Unblock a user. Owners and moderators.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, userId: targetUserId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canUnblock = await canManageCircleBlockedList(circleId, user.id);
    if (!canUnblock) {
      return NextResponse.json(
        { error: "Only circle owners and moderators can unblock users" },
        { status: 403 }
      );
    }

    const { data: deleted, error } = await supabase
      .from("circle_blocked_users")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error unblocking user:", error);
      return NextResponse.json(
        { error: "Failed to unblock user", details: error.message },
        { status: 500 }
      );
    }

    if (deleted) {
      await supabase.from("circle_moderation_activity_log").insert({
        circle_id: circleId,
        actor_id: user.id,
        action: "user_unblocked",
        target_type: "user",
        target_id: targetUserId,
        metadata: {},
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/circles/[id]/blocked/[userId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
