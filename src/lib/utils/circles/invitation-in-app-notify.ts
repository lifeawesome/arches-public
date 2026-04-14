import { createClient as createAdminClient } from "@supabase/supabase-js";

function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type NotifyExistingUserOfCircleInvitationParams = {
  invitedEmail: string;
  membershipId: string;
  circleId: string;
  circleName: string;
  inviterUserId: string;
  inviterName?: string;
  joinLink: string;
};

/**
 * If invited_email matches a registered user, create an in-app notification.
 * No-op when service role env is missing, no profile match, or inviter is the invitee.
 * Duplicate notification_key is logged and ignored (idempotent).
 */
export async function notifyExistingUserOfCircleInvitation(
  params: NotifyExistingUserOfCircleInvitationParams
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[invitation-in-app-notify] Missing Supabase URL or service role key; skipping in-app invite notification.");
    return;
  }

  const normalized = params.invitedEmail.trim().toLowerCase();
  if (!normalized) return;

  const adminDb = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: byExact, error: exactErr } = await adminDb
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (exactErr) {
    console.error("[invitation-in-app-notify] Profile lookup failed:", exactErr.message);
    return;
  }

  let inviteeId = byExact?.id as string | undefined;

  if (!inviteeId) {
    const { data: byIlike, error: ilikeErr } = await adminDb
      .from("profiles")
      .select("id")
      .ilike("email", escapeIlikeLiteral(normalized))
      .maybeSingle();

    if (ilikeErr) {
      console.error("[invitation-in-app-notify] Profile ilike lookup failed:", ilikeErr.message);
      return;
    }
    inviteeId = byIlike?.id as string | undefined;
  }

  if (!inviteeId || inviteeId === params.inviterUserId) return;

  const inviterLabel = params.inviterName?.trim() || "Someone";
  const title = `Invitation to ${params.circleName}`;
  const message = `${inviterLabel} invited you to join the circle "${params.circleName}".`;

  const notificationKey = `circle_invite_${params.membershipId}`;

  const { error: rpcErr } = await adminDb.rpc("create_notification_event", {
    p_user_id: inviteeId,
    p_event_type: "circle_invitation_received",
    p_title: title,
    p_message: message,
    p_metadata: {
      circle_id: params.circleId,
      circle_name: params.circleName,
      membership_id: params.membershipId,
      invited_by: params.inviterUserId,
      notification_key: notificationKey,
    },
    p_action_url: params.joinLink,
    p_priority: "normal",
    p_channels: ["in_app"],
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    if (msg.includes("duplicate key") || msg.includes("idx_notification_events_idempotency")) {
      return;
    }
    console.error("[invitation-in-app-notify] create_notification_event failed:", rpcErr.message);
  }
}
