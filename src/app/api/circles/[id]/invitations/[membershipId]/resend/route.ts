import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canInviteMembers } from "@/lib/utils/circles/access-control";
import { sendCircleInvitationEmail, buildCircleJoinLink } from "@/lib/utils/circles/invitation-email";
import { checkResendRateLimit } from "@/lib/utils/circles/invitation-rate-limit";
import type { CircleInvitationAuditAction } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string; membershipId: string }> };

/**
 * POST /api/circles/[id]/invitations/[membershipId]/resend
 * Regenerate token, update sent_at, re-send email. Rate limited.
 * In-app invite notifications are only sent on initial invite (idempotent key per membership); resend does not duplicate them.
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

    const canInvite = await canInviteMembers(circleId, user.id);
    if (!canInvite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimit = checkResendRateLimit(user.id, membershipId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many resend attempts. Try again later.", retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : undefined }
      );
    }

    const { data: membership, error: fetchError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, invited_email, invitation_expires_at, status")
      .eq("id", membershipId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !membership) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (membership.status !== "pending") {
      return NextResponse.json({ error: "Invitation is no longer pending" }, { status: 400 });
    }

    const invitedEmail = membership.invited_email as string | null;
    if (!invitedEmail) {
      return NextResponse.json({ error: "Invitation has no email" }, { status: 400 });
    }

    const newToken = crypto.randomUUID();
    const { data: circle } = await supabase.from("circles").select("name, status").eq("id", circleId).single();
    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
    if ((circle as { status: string }).status !== "active") {
      return NextResponse.json(
        { error: "This circle is not accepting invitations right now." },
        { status: 403 }
      );
    }
    const { data: inviterProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

    const { error: updateError } = await supabase
      .from("circle_memberships")
      .update({
        invitation_token: newToken,
        invitation_sent_at: new Date().toISOString(),
      })
      .eq("id", membershipId)
      .eq("circle_id", circleId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update invitation" }, { status: 500 });
    }

    const joinLink = buildCircleJoinLink(newToken);
    const emailResult = await sendCircleInvitationEmail({
      to: invitedEmail,
      circleName: (circle as { name: string })?.name ?? "Circle",
      inviterName: inviterProfile?.full_name?.trim() ?? undefined,
      joinLink,
      expiresAt: membership.invitation_expires_at as string | null | undefined,
    });

    await supabase.from("circle_invitation_audit_log").insert({
      circle_id: circleId,
      membership_id: membershipId,
      action: "invitation_resent" as CircleInvitationAuditAction,
      performed_by: user.id,
      invited_email: invitedEmail,
    });

    return NextResponse.json({
      success: true,
      invitation_sent_at: new Date().toISOString(),
      emailSent: emailResult.success,
      emailError: emailResult.error,
    });
  } catch (err) {
    console.error("POST /api/circles/[id]/invitations/[membershipId]/resend:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
