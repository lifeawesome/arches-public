/**
 * Circle invitation email via Resend API.
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL (e.g. "Arches <invites@yourdomain.com>") in env.
 */

import { getURL } from "@/lib/utils/helpers";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendCircleInvitationEmailParams {
  to: string;
  circleName: string;
  inviterName?: string;
  message?: string;
  joinLink: string;
  expiresAt?: string | null;
}

function buildInvitationHtml(params: SendCircleInvitationEmailParams): string {
  const { circleName, inviterName, message, joinLink, expiresAt } = params;
  const inviterLine = inviterName
    ? `<p>You've been invited by <strong>${escapeHtml(inviterName)}</strong> to join the circle.</p>`
    : "<p>You've been invited to join a circle.</p>";
  const messageLine = message
    ? `<p>Message from your inviter:</p><blockquote style="margin:1em 0;padding:0.5em 1em;border-left:4px solid #ccc;color:#555;">${escapeHtml(message)}</blockquote>`
    : "";
  const expiryLine =
    expiresAt &&
    `<p style="color:#666;font-size:0.9em;">This invitation expires on ${escapeHtml(new Date(expiresAt).toLocaleDateString())}.</p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:1.25rem;">Join ${escapeHtml(circleName)}</h1>
  ${inviterLine}
  ${messageLine}
  <p><a href="${escapeHtml(joinLink)}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Accept invitation</a></p>
  <p style="font-size:0.9em;color:#666;">Or copy this link: ${escapeHtml(joinLink)}</p>
  ${expiryLine || ""}
</body>
</html>
`.trim();
}

function buildInvitationText(params: SendCircleInvitationEmailParams): string {
  const { circleName, inviterName, message, joinLink, expiresAt } = params;
  const inviterLine = inviterName
    ? `You've been invited by ${inviterName} to join the circle.\n\n`
    : "You've been invited to join a circle.\n\n";
  const messageLine = message ? `Message from your inviter:\n${message}\n\n` : "";
  const expiryLine =
    expiresAt &&
    `This invitation expires on ${new Date(expiresAt).toLocaleDateString()}.\n\n`;

  return `Join ${circleName}\n\n${inviterLine}${messageLine}Accept invitation: ${joinLink}\n\n${expiryLine || ""}`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isResendConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Send a circle invitation email. No-op if Resend is not configured (returns { success: true }).
 */
export async function sendCircleInvitationEmail(
  params: SendCircleInvitationEmailParams
): Promise<{ success: boolean; error?: string }> {
  if (!isResendConfigured()) {
    console.warn("Resend not configured (RESEND_API_KEY / RESEND_FROM_EMAIL); skipping invitation email.");
    return { success: true };
  }

  const from = process.env.RESEND_FROM_EMAIL!;
  const subject = `You're invited to join ${params.circleName}`;
  const html = buildInvitationHtml(params);
  const text = buildInvitationText(params);

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend API error:", res.status, body);
      return { success: false, error: body || res.statusText };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to send invitation email:", message);
    return { success: false, error: message };
  }
}

/**
 * Build the join link for an invitation token.
 */
export function buildCircleJoinLink(token: string): string {
  return getURL(`circles/join?token=${encodeURIComponent(token)}`);
}
