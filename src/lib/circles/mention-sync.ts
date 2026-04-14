import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMentionHandles, rewriteMentionLinksInMarkdown, type MentionRewritePair } from "./mentions";

type AdminClient = SupabaseClient;

async function resolveHandlesToUserIds(
  admin: AdminClient,
  handles: string[]
): Promise<Map<string, { userId: string; canonical: string }>> {
  const map = new Map<string, { userId: string; canonical: string }>();
  if (handles.length === 0) return map;

  const { data: rows, error } = await admin.rpc("resolve_profile_usernames", {
    p_handles: handles,
  });

  if (error) {
    console.error("[mentions] resolve_profile_usernames:", error.message);
    return map;
  }

  for (const r of (rows ?? []) as { id: string; username: string }[]) {
    map.set(r.username.toLowerCase(), { userId: r.id, canonical: r.username });
  }
  return map;
}

async function assertUsersAreCircleParticipants(
  admin: AdminClient,
  circleId: string,
  userIds: string[]
): Promise<boolean> {
  if (userIds.length === 0) return true;

  const { data: circle, error: cErr } = await admin
    .from("circles")
    .select("expert_id")
    .eq("id", circleId)
    .single();
  if (cErr || !circle) return false;

  const expertId = (circle as { expert_id: string }).expert_id;
  const remaining = userIds.filter((id) => id !== expertId);
  if (remaining.length === 0) return true;

  const { data: mems, error: mErr } = await admin
    .from("circle_memberships")
    .select("user_id")
    .eq("circle_id", circleId)
    .eq("status", "active")
    .in("user_id", remaining);

  if (mErr) return false;
  const ok = new Set((mems ?? []).map((m) => (m as { user_id: string }).user_id));
  return remaining.every((id) => ok.has(id));
}

function buildMentionActionUrl(params: {
  circleSlug: string;
  contentId: string | null;
  commentId: string | null;
}): string {
  const slugSeg = encodeURIComponent(params.circleSlug);
  const base = `/circles/${slugSeg}/posts/${params.contentId ?? ""}`;
  if (params.commentId) {
    return `${base}#comment-${params.commentId}`;
  }
  return base;
}

export type MentionValidationResult =
  | { ok: true; rewrittenText: string; pairs: MentionRewritePair[] }
  | { ok: false; error: string; status: number };

/**
 * Validates @handles and returns rewritten markdown (profile links). Call before persisting content.
 */
export async function validateCircleMentionText(options: {
  admin: AdminClient;
  circleId: string;
  text: string;
  authorId: string;
}): Promise<MentionValidationResult> {
  const handles = extractMentionHandles(options.text);
  if (handles.length === 0) {
    return { ok: true, rewrittenText: options.text, pairs: [] };
  }

  const resolved = await resolveHandlesToUserIds(options.admin, handles);
  const pairs: MentionRewritePair[] = [];
  const missing: string[] = [];

  for (const h of handles) {
    const hit = resolved.get(h.toLowerCase());
    if (!hit) {
      missing.push(h);
      continue;
    }
    pairs.push({ username: hit.canonical, userId: hit.userId });
  }

  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Unknown or unset username for mention: ${missing.map((m) => `@${m}`).join(", ")}. Members need a unique username on their profile to be mentioned.`,
    };
  }

  const userIds = [...new Set(pairs.map((p) => p.userId))];
  const allowed = await assertUsersAreCircleParticipants(options.admin, options.circleId, userIds);
  if (!allowed) {
    return {
      ok: false,
      status: 400,
      error: "One or more mentions are not active members of this circle.",
    };
  }

  return {
    ok: true,
    rewrittenText: rewriteMentionLinksInMarkdown(options.text, pairs),
    pairs,
  };
}

/**
 * Persists circle_mentions rows and sends notifications for newly mentioned users.
 */
export async function applyMentionsAfterContentSave(options: {
  admin: AdminClient;
  circleId: string;
  contentId: string | null;
  commentId: string | null;
  authorId: string;
  pairs: MentionRewritePair[];
}): Promise<{ error?: string }> {
  const { admin, circleId, contentId, commentId, authorId, pairs } = options;

  if (commentId) {
    await admin.from("circle_mentions").delete().eq("comment_id", commentId);
  } else if (contentId) {
    await admin.from("circle_mentions").delete().eq("content_id", contentId);
  }

  const persistPairs = pairs.filter((p) => p.userId !== authorId);
  if (persistPairs.length === 0) return {};

  const userIds = [...new Set(persistPairs.map((p) => p.userId))];

  const rows = userIds.map((mentionedUserId) => ({
    circle_id: circleId,
    content_id: commentId ? null : contentId,
    comment_id: commentId,
    mentioned_user_id: mentionedUserId,
    mentioned_by: authorId,
  }));

  const { error: insErr } = await admin.from("circle_mentions").insert(rows);
  if (insErr) {
    console.error("[mentions] insert:", insErr.message);
    return { error: "Failed to save mentions" };
  }

  const { data: circleRow } = await admin.from("circles").select("slug").eq("id", circleId).maybeSingle();
  const circleSlug = (circleRow as { slug?: string } | null)?.slug?.trim() || circleId;

  const actionUrl = buildMentionActionUrl({ circleSlug, contentId, commentId });

  for (const uid of userIds) {
    const pair = persistPairs.find((p) => p.userId === uid);
    if (!pair) continue;

    const { error: rpcErr } = await admin.rpc("notify_circle_user_mentioned", {
      p_circle_id: circleId,
      p_content_id: contentId,
      p_comment_id: commentId,
      p_mentioned_user_id: uid,
      p_mentioned_by: authorId,
      p_mention_username: pair.username,
      p_action_url: actionUrl,
    });
    if (rpcErr) {
      console.error("[mentions] notify:", rpcErr.message);
    }
  }

  return {};
}
