import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isBlockedFromCircle } from "@/lib/utils/circles/access-control";
import type { CircleInvitationAuditAction } from "@/types/circles";

/**
 * GET /api/circles/join/accept?token=...
 * Validation only: returns circle + invitation info, never mutates membership.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token?.trim()) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: membership, error: memError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, user_id, status, invitation_expires_at")
      .eq("invitation_token", token.trim())
      .single();

    if (memError || !membership) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (membership.status !== "pending" || membership.user_id != null) {
      return NextResponse.json({ error: "Invitation already used" }, { status: 400 });
    }

    if (membership.invitation_expires_at && new Date(membership.invitation_expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
    }

    // If the invitation is valid but the user is not authenticated,
    // let the frontend redirect to login with a 401.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: circle } = await supabase
      .from("circles")
      .select("id, name, slug, status")
      .eq("id", membership.circle_id)
      .single();

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
    if ((circle as { status: string }).status !== "active") {
      return NextResponse.json(
        { error: "This circle is not accepting new members right now." },
        { status: 403 }
      );
    }

    const circleInfo = {
      id: circle.id,
      name: (circle as { name: string }).name,
      slug: (circle as { slug: string }).slug,
    };

    return NextResponse.json({
      valid: true,
      circle: circleInfo,
      invitation: {
        status: membership.status,
        expires_at: membership.invitation_expires_at,
      },
      accepted: false,
    });
  } catch (err) {
    console.error("GET /api/circles/join/accept:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/circles/join/accept
 * Body: { token }. Same as GET with token - validate and accept if authenticated.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership, error: memError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, user_id, status, invitation_expires_at")
      .eq("invitation_token", token)
      .single();

    if (memError || !membership) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (membership.status !== "pending" || membership.user_id != null) {
      return NextResponse.json({ error: "Invitation already used" }, { status: 400 });
    }

    if (membership.invitation_expires_at && new Date(membership.invitation_expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
    }

    if (await isBlockedFromCircle(membership.circle_id, user.id)) {
      return NextResponse.json(
        { error: "You cannot join this circle" },
        { status: 403 }
      );
    }

    const { data: circleRow } = await supabase
      .from("circles")
      .select("status")
      .eq("id", membership.circle_id)
      .single();
    if (circleRow && (circleRow as { status: string }).status !== "active") {
      return NextResponse.json(
        { error: "This circle is not accepting new members right now." },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabase
      .from("circle_memberships")
      .update({
        user_id: user.id,
        status: "active",
        invitation_accepted_at: new Date().toISOString(),
      })
      .eq("id", membership.id)
      .is("user_id", null);

    if (updateError) {
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
    }

    await supabase.from("circle_invitation_audit_log").insert({
      circle_id: membership.circle_id,
      membership_id: membership.id,
      action: "invitation_accepted" as CircleInvitationAuditAction,
      performed_by: user.id,
      invited_email: null,
    });

    const { data: circle } = await supabase
      .from("circles")
      .select("id, name, slug")
      .eq("id", membership.circle_id)
      .single();

    return NextResponse.json({
      accepted: true,
      circle: circle ? { id: circle.id, name: (circle as { name: string }).name, slug: (circle as { slug: string }).slug } : null,
    });
  } catch (err) {
    console.error("POST /api/circles/join/accept:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
