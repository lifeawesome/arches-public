import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canModerateContent } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

type BulkAction = "approve" | "reject" | "soft_delete";

/**
 * POST /api/circles/[id]/moderation/bulk
 * Bulk moderation actions. Body: { action: 'approve' | 'reject' | 'soft_delete', content_ids?: string[], comment_ids?: string[] }
 * Moderators/owners only.
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

    const canModerate = await canModerateContent(circleId, user.id);
    if (!canModerate) {
      return NextResponse.json(
        { error: "Only moderators and owners can perform bulk actions" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      action?: BulkAction;
      content_ids?: string[];
      comment_ids?: string[];
      rejection_reason?: string;
    };
    const { action, content_ids, comment_ids, rejection_reason } = body;

    if (!action || !["approve", "reject", "soft_delete"].includes(action)) {
      return NextResponse.json(
        { error: "action must be one of: approve, reject, soft_delete" },
        { status: 400 }
      );
    }

    const contentIds = Array.isArray(content_ids) ? content_ids.filter((id) => typeof id === "string") : [];
    const commentIds = Array.isArray(comment_ids) ? comment_ids.filter((id) => typeof id === "string") : [];

    if (contentIds.length === 0 && commentIds.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one content_ids or comment_ids" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let contentApproved = 0;
    let contentRejected = 0;
    let contentSoftDeleted = 0;
    let commentSoftDeleted = 0;

    if (action === "approve" && contentIds.length > 0) {
      for (const contentId of contentIds) {
        const { data: row } = await supabase
          .from("circle_content")
          .select("id, circle_id, approval_status")
          .eq("id", contentId)
          .eq("circle_id", circleId)
          .single();
        if (row && (row as { approval_status: string }).approval_status === "pending") {
          const { error: up } = await supabase
            .from("circle_content")
            .update({
              approval_status: "approved",
              is_published: true,
              published_at: now,
              approved_by: user.id,
              approved_at: now,
              updated_at: now,
            })
            .eq("id", contentId)
            .eq("circle_id", circleId);
          if (!up) {
            contentApproved++;
            await supabase.from("circle_moderation_activity_log").insert({
              circle_id: circleId,
              actor_id: user.id,
              action: "content_approved",
              target_type: "content",
              target_id: contentId,
              metadata: {},
            });
          }
        }
      }
    }

    if (action === "reject" && contentIds.length > 0) {
      for (const contentId of contentIds) {
        const { data: row } = await supabase
          .from("circle_content")
          .select("id, circle_id")
          .eq("id", contentId)
          .eq("circle_id", circleId)
          .single();
        if (row) {
          const { error: upErr } = await supabase
            .from("circle_content")
            .update({
              approval_status: "rejected",
              is_published: false,
              rejection_reason: rejection_reason ?? null,
              updated_at: now,
            })
            .eq("id", contentId)
            .eq("circle_id", circleId);
          if (!upErr) {
            contentRejected++;
            await supabase.from("circle_moderation_activity_log").insert({
              circle_id: circleId,
              actor_id: user.id,
              action: "content_rejected",
              target_type: "content",
              target_id: contentId,
              metadata: { reason: rejection_reason ?? undefined },
            });
          }
        }
      }
    }

    if (action === "soft_delete") {
      for (const contentId of contentIds) {
        const { data: row } = await supabase
          .from("circle_content")
          .select("id, circle_id, is_deleted")
          .eq("id", contentId)
          .eq("circle_id", circleId)
          .single();
        if (row && !(row as { is_deleted?: boolean }).is_deleted) {
          const { error: upErr } = await supabase
            .from("circle_content")
            .update({
              is_deleted: true,
              deleted_at: now,
              deleted_by: user.id,
              updated_at: now,
            })
            .eq("id", contentId)
            .eq("circle_id", circleId);
          if (!upErr) {
            contentSoftDeleted++;
            await supabase.from("circle_moderation_activity_log").insert({
              circle_id: circleId,
              actor_id: user.id,
              action: "content_soft_deleted",
              target_type: "content",
              target_id: contentId,
              metadata: {},
            });
          }
        }
      }
      for (const commentId of commentIds) {
        const { data: comment } = await supabase
          .from("circle_comments")
          .select("id, content_id, is_deleted")
          .eq("id", commentId)
          .single();
        if (comment && !(comment as { is_deleted?: boolean }).is_deleted) {
          const { data: content } = await supabase
            .from("circle_content")
            .select("circle_id")
            .eq("id", (comment as { content_id: string }).content_id)
            .single();
          if (content && (content as { circle_id: string }).circle_id === circleId) {
            const { error: upErr } = await supabase
              .from("circle_comments")
              .update({
                is_deleted: true,
                deleted_at: now,
                deleted_by: user.id,
                updated_at: now,
              })
              .eq("id", commentId);
            if (!upErr) {
              commentSoftDeleted++;
              await supabase.from("circle_moderation_activity_log").insert({
                circle_id: circleId,
                actor_id: user.id,
                action: "comment_soft_deleted",
                target_type: "comment",
                target_id: commentId,
                metadata: {},
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      content_approved: contentApproved,
      content_rejected: contentRejected,
      content_soft_deleted: contentSoftDeleted,
      comment_soft_deleted: commentSoftDeleted,
    });
  } catch (err) {
    console.error("POST /api/circles/[id]/moderation/bulk:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
