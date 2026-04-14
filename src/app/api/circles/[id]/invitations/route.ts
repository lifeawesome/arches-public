import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canInviteMembers } from "@/lib/utils/circles/access-control";
import { sendCircleInvitationEmail, buildCircleJoinLink } from "@/lib/utils/circles/invitation-email";
import { notifyExistingUserOfCircleInvitation } from "@/lib/utils/circles/invitation-in-app-notify";
import { checkInviteRateLimit } from "@/lib/utils/circles/invitation-rate-limit";
import type { InviteMemberInput, CircleMemberRole, CircleInvitationAuditAction } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/invitations
 * List pending invitations. Caller must be able to manage members or invite.
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

    const canInvite = await canInviteMembers(circleId, user.id);
    const { canManageMembers } = await import("@/lib/utils/circles/access-control");
    const canManage = await canManageMembers(circleId, user.id);
    if (!canInvite && !canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, invited_email, role, invited_by, invitation_sent_at, invitation_expires_at")
      .eq("circle_id", circleId)
      .eq("status", "pending")
      .not("invitation_token", "is", null)
      .order("invitation_sent_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch invitations", details: error.message }, { status: 500 });
    }

    const invitations = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      circle_id: r.circle_id,
      invited_email: r.invited_email,
      role: r.role,
      invited_by: r.invited_by,
      invitation_sent_at: r.invitation_sent_at,
      invitation_expires_at: r.invitation_expires_at,
    }));

    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("GET /api/circles/[id]/invitations:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * POST /api/circles/[id]/invitations
 * Create one or more invitations. Body: { email?, emails?, role?, message?, expires_in_days? }
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

    const canInvite = await canInviteMembers(circleId, user.id);
    if (!canInvite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as InviteMemberInput & { emails?: string[] };
    const emails: string[] = body.emails?.length
      ? body.emails.filter((e) => typeof e === "string" && isValidEmail(e))
      : body.email && isValidEmail(body.email)
        ? [body.email]
        : [];
    if (emails.length === 0) {
      return NextResponse.json({ error: "At least one valid email is required" }, { status: 400 });
    }

    const rateLimit = checkInviteRateLimit(user.id, circleId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many invitations. Try again later.", retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : undefined }
      );
    }

    const role: CircleMemberRole = body.role ?? "member";
    const message = typeof body.message === "string" ? body.message : undefined;
    const expiresInDays = typeof body.expires_in_days === "number" && body.expires_in_days > 0 ? body.expires_in_days : undefined;

    const { data: circle } = await supabase
      .from("circles")
      .select("id, name, status")
      .eq("id", circleId)
      .single();
    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
    if ((circle as { status: string }).status !== "active") {
      return NextResponse.json(
        { error: "This circle is not accepting new members or invitations right now." },
        { status: 403 }
      );
    }

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const inviterName = inviterProfile?.full_name?.trim() ?? undefined;

    const results: { email: string; success: boolean; id?: string; error?: string }[] = [];
    const created: { id: string; email: string; invitation_sent_at: string; invitation_expires_at: string | null }[] = [];

    for (const email of emails) {
      const token = crypto.randomUUID();
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: row, error: insertError } = await supabase
        .from("circle_memberships")
        .insert({
          circle_id: circleId,
          user_id: null,
          status: "pending",
          role,
          invited_by: user.id,
          invitation_token: token,
          invitation_sent_at: new Date().toISOString(),
          invitation_expires_at: expiresAt,
          invited_email: email.toLowerCase(),
        })
        .select("id, invitation_sent_at, invitation_expires_at")
        .single();

      if (insertError) {
        results.push({ email, success: false, error: insertError.message });
        continue;
      }

      const joinLink = buildCircleJoinLink(token);
      await notifyExistingUserOfCircleInvitation({
        invitedEmail: email,
        membershipId: row.id,
        circleId,
        circleName: (circle as { name: string }).name,
        inviterUserId: user.id,
        inviterName,
        joinLink,
      });

      const emailResult = await sendCircleInvitationEmail({
        to: email,
        circleName: (circle as { name: string }).name,
        inviterName,
        message,
        joinLink,
        expiresAt,
      });

      if (!emailResult.success) {
        results.push({ email, success: true, id: row.id, error: "Invitation created but email failed to send" });
      } else {
        results.push({ email, success: true, id: row.id });
      }

      created.push({
        id: row.id,
        email,
        invitation_sent_at: row.invitation_sent_at,
        invitation_expires_at: row.invitation_expires_at,
      });

      await supabase.from("circle_invitation_audit_log").insert({
        circle_id: circleId,
        membership_id: row.id,
        action: "invitation_sent" as CircleInvitationAuditAction,
        performed_by: user.id,
        invited_email: email,
      });
    }

    return NextResponse.json({
      invitations: results,
      created: created.length ? created : undefined,
    });
  } catch (err) {
    console.error("POST /api/circles/[id]/invitations:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
