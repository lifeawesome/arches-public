import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CircleInvitationAuditAction } from "@/types/circles";

/**
 * POST /api/circles/join/reject
 * Body: { token }. Marks a pending invitation as effectively rejected.
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
      .select("id, circle_id, status, user_id, invited_email")
      .eq("invitation_token", token)
      .single();

    if (memError || !membership) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (membership.status !== "pending" || membership.user_id !== null) {
      return NextResponse.json({ error: "Invitation is not pending" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("circle_memberships")
      .update({
        invitation_token: null,
        invitation_expires_at: new Date().toISOString(),
      })
      .eq("id", membership.id)
      .eq("status", "pending");

    if (updateError) {
      return NextResponse.json({ error: "Failed to reject invitation" }, { status: 500 });
    }

    await supabase.from("circle_invitation_audit_log").insert({
      circle_id: membership.circle_id,
      membership_id: membership.id,
      action: "invitation_revoked" as CircleInvitationAuditAction,
      performed_by: user.id,
      invited_email: (membership as { invited_email?: string }).invited_email ?? null,
    });

    return NextResponse.json({ rejected: true });
  } catch (err) {
    console.error("POST /api/circles/join/reject:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

