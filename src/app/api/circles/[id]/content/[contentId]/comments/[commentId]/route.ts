import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  canDeleteAnyComment,
  canModerateContent,
} from "@/lib/utils/circles/access-control";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  markdownLimits,
  normalizeMarkdownInput,
} from "@/lib/utils/markdown";
import { extractMentionHandles } from "@/lib/circles/mentions";
import { applyMentionsAfterContentSave, validateCircleMentionText } from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string; contentId: string; commentId: string }> };

/**
 * PATCH /api/circles/[id]/content/[contentId]/comments/[commentId]
 * Author or moderator: update comment text (re-syncs mentions).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId, commentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: comment, error: fetchError } = await supabase
      .from("circle_comments")
      .select("id, content_id, user_id, is_deleted")
      .eq("id", commentId)
      .eq("content_id", contentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { data: content } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .single();

    if (!content || (content as { circle_id: string }).circle_id !== circleId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const row = comment as { user_id: string; is_deleted: boolean | null };
    if (row.is_deleted) {
      return NextResponse.json({ error: "Comment was removed" }, { status: 400 });
    }

    const isModeratorOrOwner = await canModerateContent(circleId, user.id);
    if (row.user_id !== user.id && !isModeratorOrOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { comment_text?: string };
    const raw = normalizeMarkdownInput(body.comment_text ?? "");
    if (!raw || !hasRenderableMarkdownContent(raw)) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
    }
    const lenErr = enforceMarkdownLength(raw, markdownLimits.maxLength);
    if (lenErr) {
      return NextResponse.json({ error: lenErr }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let textToStore = raw;
    let mentionPairs: { username: string; userId: string }[] = [];
    if (extractMentionHandles(raw).length > 0) {
      const prep = await validateCircleMentionText({
        admin: mentionAdmin,
        circleId,
        text: raw,
        authorId: row.user_id,
      });
      if (!prep.ok) {
        return NextResponse.json({ error: prep.error }, { status: prep.status });
      }
      textToStore = prep.rewrittenText;
      mentionPairs = prep.pairs;
    }

    const { data: updated, error: upErr } = await supabase
      .from("circle_comments")
      .update({
        comment_text: textToStore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .eq("content_id", contentId)
      .select(
        "id, content_id, user_id, comment_text, parent_comment_id, like_count, downvote_count, is_deleted, created_at, updated_at"
      )
      .single();

    if (upErr || !updated) {
      console.error("PATCH comment:", upErr);
      return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
    }

    const applyErr = await applyMentionsAfterContentSave({
      admin: mentionAdmin,
      circleId,
      contentId,
      commentId,
      authorId: row.user_id,
      pairs: mentionPairs,
    });
    if (applyErr.error) {
      console.error("[comment PATCH] mentions:", applyErr.error);
    }

    return NextResponse.json({ comment: updated });
  } catch (err) {
    console.error("PATCH comment:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circles/[id]/content/[contentId]/comments/[commentId]
 * Moderators/owners: soft delete and log. Authors: hard delete own comment.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId, commentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: comment, error: fetchError } = await supabase
      .from("circle_comments")
      .select("id, content_id, user_id")
      .eq("id", commentId)
      .eq("content_id", contentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { data: content } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .single();

    if (!content || (content as { circle_id: string }).circle_id !== circleId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const isModeratorOrOwner = await canModerateContent(circleId, user.id);
    const isAuthor = (comment as { user_id: string }).user_id === user.id;

    if (!isModeratorOrOwner && !isAuthor) {
      const allowed = await canDeleteAnyComment(commentId, user.id);
      if (!allowed) {
        return NextResponse.json(
          { error: "You do not have permission to delete this comment" },
          { status: 403 }
        );
      }
    }

    if (isModeratorOrOwner) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("circle_comments")
        .update({
          is_deleted: true,
          deleted_at: now,
          deleted_by: user.id,
          updated_at: now,
        })
        .eq("id", commentId)
        .eq("content_id", contentId);

      if (updateError) {
        console.error("Error soft-deleting comment:", updateError);
        return NextResponse.json(
          { error: "Failed to delete comment", details: updateError.message },
          { status: 500 }
        );
      }

      await supabase.from("circle_moderation_activity_log").insert({
        circle_id: circleId,
        actor_id: user.id,
        action: "comment_soft_deleted",
        target_type: "comment",
        target_id: commentId,
        metadata: {},
      });
    } else {
      const { error: deleteError } = await supabase
        .from("circle_comments")
        .delete()
        .eq("id", commentId)
        .eq("content_id", contentId);

      if (deleteError) {
        console.error("Error deleting comment:", deleteError);
        return NextResponse.json(
          { error: "Failed to delete comment", details: deleteError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE comment:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
