import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  canBlockTargetUserInCircle,
  canManageCircleBlockedList,
} from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/blocked
 * List blocked users for the circle. Owners and moderators.
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

    const canView = await canManageCircleBlockedList(circleId, user.id);
    if (!canView) {
      return NextResponse.json(
        { error: "Only circle owners and moderators can view the blocked list" },
        { status: 403 }
      );
    }

    const { data: rows, error } = await supabase
      .from("circle_blocked_users")
      .select(
        `
        id,
        circle_id,
        user_id,
        blocked_by,
        created_at
        `
      )
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching blocked users:", error);
      return NextResponse.json(
        { error: "Failed to load blocked users", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ blocked: rows ?? [] });
  } catch (err) {
    console.error("GET /api/circles/[id]/blocked:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/circles/[id]/blocked
 * Block a user from the circle. Owners and moderators (with target rules). Body: { user_id: string }
 * Optionally sets the user's membership to cancelled so they cannot access the circle.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageCircleBlockedList(circleId, user.id);
    if (!canManage) {
      return NextResponse.json(
        { error: "Only circle owners and moderators can block users" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { user_id?: string };
    const targetUserId = body?.user_id;
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid user_id in body" },
        { status: 400 }
      );
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "You cannot block yourself" },
        { status: 400 }
      );
    }

    const allowedTarget = await canBlockTargetUserInCircle(
      circleId,
      user.id,
      targetUserId
    );
    if (!allowedTarget) {
      return NextResponse.json(
        { error: "You cannot block this user" },
        { status: 403 }
      );
    }

    const { data: existing } = await supabase
      .from("circle_blocked_users")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "User is already blocked", blocked: true },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("circle_blocked_users")
      .insert({
        circle_id: circleId,
        user_id: targetUserId,
        blocked_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error blocking user:", insertError);
      return NextResponse.json(
        { error: "Failed to block user", details: insertError.message },
        { status: 500 }
      );
    }

    // Deactivate the blocked user's membership so RLS and membership checks
    // no longer treat them as an active member.
    const { error: membershipError } = await supabase
      .from("circle_memberships")
      .update({ status: "cancelled" })
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .eq("status", "active");

    if (membershipError) {
      console.error("Error deactivating membership for blocked user:", membershipError);
    }

    await supabase.from("circle_moderation_activity_log").insert({
      circle_id: circleId,
      actor_id: user.id,
      action: "user_blocked",
      target_type: "user",
      target_id: targetUserId,
      metadata: {},
    });

    return NextResponse.json({ blocked: inserted }, { status: 201 });
  } catch (err) {
    console.error("POST /api/circles/[id]/blocked:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
