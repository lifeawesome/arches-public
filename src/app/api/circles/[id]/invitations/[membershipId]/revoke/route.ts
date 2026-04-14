import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canManageMembers, canInviteMembers } from "@/lib/utils/circles/access-control";
import type { CircleInvitationAuditAction } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string; membershipId: string }> };

/**
 * POST /api/circles/[id]/invitations/[membershipId]/revoke
 * Revoke a pending invitation (delete row or invalidate). Caller must be able to manage members or invite.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, membershipId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await canManageMembers(circleId, user.id);
    const canInvite = await canInviteMembers(circleId, user.id);
    if (!canManage && !canInvite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: membership, error: fetchError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, status, invited_email")
      .eq("id", membershipId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !membership) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (membership.status !== "pending") {
      return NextResponse.json({ error: "Invitation is not pending" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("circle_memberships")
      .update({
        invitation_token: null,
        invitation_expires_at: new Date().toISOString(),
      })
      .eq("id", membershipId)
      .eq("circle_id", circleId)
      .eq("status", "pending");

    if (updateError) {
      return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
    }

    await supabase.from("circle_invitation_audit_log").insert({
      circle_id: circleId,
      membership_id: membershipId,
      action: "invitation_revoked" as CircleInvitationAuditAction,
      performed_by: user.id,
      invited_email: (membership as { invited_email?: string }).invited_email ?? null,
    });

    return NextResponse.json({ success: true, revoked: true });
  } catch (err) {
    console.error("POST /api/circles/[id]/invitations/[membershipId]/revoke:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circles/[id]/invitations/[membershipId]/revoke
 * Alias for POST revoke.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; membershipId: string }> }) {
  return POST(request, context);
}
