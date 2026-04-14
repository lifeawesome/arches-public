import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveInitialApprovalStatusWithClient } from "@/lib/utils/circles/access-control";

function getServiceAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Publishes due scheduled posts (content_type = post). Uses service role.
 * @param circleId - if set, only rows in this circle; if null, all circles (cron).
 */
export async function processDueScheduledPosts(options: {
  circleId?: string | null;
  limit?: number;
}): Promise<{ processed: number }> {
  const admin = getServiceAdmin();
  if (!admin) {
    return { processed: 0 };
  }

  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const nowIso = new Date().toISOString();

  let q = admin
    .from("circle_content")
    .select("id, circle_id, author_id, content_type")
    .eq("publication_status", "scheduled")
    .lte("scheduled_for", nowIso)
    .eq("content_type", "post")
    .limit(limit);

  if (options.circleId) {
    q = q.eq("circle_id", options.circleId);
  }

  const { data: rows, error } = await q;

  if (error) {
    console.error("[processDueScheduledPosts] query:", error);
    return { processed: 0 };
  }

  let processed = 0;
  for (const row of rows ?? []) {
    const r = row as { id: string; circle_id: string; author_id: string; content_type: string };
    const approvalStatus = await resolveInitialApprovalStatusWithClient(admin, r.circle_id, r.author_id);
    const isPublished = approvalStatus === "approved";
    const ts = new Date().toISOString();

    const { error: upErr } = await admin
      .from("circle_content")
      .update({
        publication_status: "published",
        scheduled_for: null,
        approval_status: approvalStatus,
        is_published: isPublished,
        published_at: isPublished ? ts : null,
        updated_at: ts,
      })
      .eq("id", r.id)
      .eq("publication_status", "scheduled");

    if (upErr) {
      console.error("[processDueScheduledPosts] update", r.id, upErr);
      continue;
    }

    processed += 1;

    if (isPublished) {
      const { error: rpcError } = await admin.rpc("notify_circle_members_of_new_post", {
        p_content_id: r.id,
      });
      if (rpcError) {
        console.error("[processDueScheduledPosts] notify", rpcError.message);
      }
    }
  }

  return { processed };
}
