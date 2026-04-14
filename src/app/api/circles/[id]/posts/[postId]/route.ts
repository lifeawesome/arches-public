import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getGuidelinesAckRequirement,
  resolveInitialApprovalStatus,
} from "@/lib/utils/circles/access-control";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  markdownLimits,
  normalizeMarkdownInput,
} from "@/lib/utils/markdown";
import type {
  CircleContentApprovalStatus,
  CircleContentPublicationStatus,
  CircleContentWithAuthor,
  CircleContentType,
} from "@/types/circles";
import { extractMentionHandles } from "@/lib/circles/mentions";
import { applyMentionsAfterContentSave, validateCircleMentionText } from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string; postId: string }> };

type PostComposeMode = "publish" | "draft" | "schedule";

function parsePostMode(raw: unknown): PostComposeMode {
  if (raw === "draft" || raw === "schedule") return raw;
  return "publish";
}

/**
 * PATCH /api/circles/[id]/posts/[postId]
 * Author may update draft/scheduled posts, or change mode (e.g. publish draft).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, postId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error: fetchError } = await supabase
      .from("circle_content")
      .select(
        "id, circle_id, author_id, content_type, title, content, publication_status, scheduled_for, published_at, is_welcome_post"
      )
      .eq("id", postId)
      .eq("circle_id", circleId)
      .eq("content_type", "post")
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const r = row as {
      author_id: string;
      is_welcome_post?: boolean;
      publication_status: CircleContentPublicationStatus;
      scheduled_for: string | null;
      published_at: string | null;
      title: string;
      content: string;
    };

    if (r.author_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (r.is_welcome_post) {
      return NextResponse.json({ error: "Cannot edit welcome post here" }, { status: 400 });
    }
    if (r.publication_status === "published") {
      return NextResponse.json({ error: "Use content moderation tools to edit published posts" }, { status: 400 });
    }

    const body = (await request.json()) as {
      title?: string;
      content?: string;
      mode?: string;
      scheduled_for?: string;
      is_free?: boolean;
    };
    /** Omit mode for autosave (title/content only). */
    const mode: PostComposeMode | "keep" = body.mode === undefined ? "keep" : parsePostMode(body.mode);

    if (mode !== "draft" && mode !== "keep") {
      const ackState = await getGuidelinesAckRequirement(circleId, user.id);
      if (ackState.required && !ackState.acknowledged) {
        return NextResponse.json(
          { error: "Please acknowledge the latest circle guidelines before posting.", code: "guidelines_ack_required" },
          { status: 403 }
        );
      }
    }

    const rawTitle = body.title ?? r.title;
    const title = String(rawTitle).trim();
    let content = body.content !== undefined ? normalizeMarkdownInput(body.content) : r.content;

    if (mode === "draft" || (mode === "keep" && r.publication_status === "draft")) {
      if (!content.trim()) {
        content = "(Empty draft)";
      }
    } else if (body.content !== undefined && mode !== "keep") {
      if (!content || !hasRenderableMarkdownContent(content)) {
        return NextResponse.json({ error: "Content is required" }, { status: 400 });
      }
    } else if (body.content !== undefined && mode === "keep") {
      if (!content.trim() && r.publication_status === "draft") {
        content = "(Empty draft)";
      } else if (!content || !hasRenderableMarkdownContent(content)) {
        return NextResponse.json({ error: "Content is required" }, { status: 400 });
      }
    }

    const lengthError = enforceMarkdownLength(content, markdownLimits.maxLength);
    if (lengthError) {
      return NextResponse.json({ error: lengthError }, { status: 400 });
    }

    const effectiveTitle =
      title || (mode === "draft" || (mode === "keep" && r.publication_status === "draft") ? "Draft" : "Post");

    if (mode === "schedule") {
      if (!body.scheduled_for) {
        return NextResponse.json({ error: "scheduled_for is required" }, { status: 400 });
      }
      const scheduledAt = new Date(body.scheduled_for);
      if (Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "Invalid scheduled_for" }, { status: 400 });
      }
      if (scheduledAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "scheduled_for must be in the future" }, { status: 400 });
      }
    }

    let publication_status: CircleContentPublicationStatus = r.publication_status;
    let scheduled_for: string | null = r.scheduled_for;
    let approvalStatus: CircleContentApprovalStatus = "approved";
    let isPublished = false;
    let published_at: string | null = r.published_at;

    if (mode === "draft") {
      publication_status = "draft";
      scheduled_for = null;
      approvalStatus = "approved";
      isPublished = false;
      published_at = null;
    } else if (mode === "schedule") {
      publication_status = "scheduled";
      scheduled_for = new Date(body.scheduled_for!).toISOString();
      approvalStatus = "approved";
      isPublished = false;
      published_at = null;
    } else if (mode === "publish") {
      publication_status = "published";
      scheduled_for = null;
      approvalStatus = await resolveInitialApprovalStatus(circleId, user.id);
      isPublished = approvalStatus === "approved";
      published_at = isPublished ? new Date().toISOString() : null;
    } else if (mode === "keep") {
      publication_status = r.publication_status;
      scheduled_for = r.scheduled_for;
      approvalStatus = "approved";
      isPublished = false;
      published_at = r.published_at;
    }

    let contentToStore = content;
    let mentionPairs: { username: string; userId: string }[] | null = null;
    const runMentions = mode === "publish" || mode === "schedule" || (mode === "keep" && r.publication_status !== "draft");
    if (runMentions && extractMentionHandles(content).length > 0) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json(
          { error: "Mentions are not available (server misconfigured)." },
          { status: 500 }
        );
      }
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const mentionPrep = await validateCircleMentionText({
        admin: mentionAdmin,
        circleId,
        text: content,
        authorId: user.id,
      });
      if (!mentionPrep.ok) {
        return NextResponse.json({ error: mentionPrep.error }, { status: mentionPrep.status });
      }
      contentToStore = mentionPrep.rewrittenText;
      mentionPairs = mentionPrep.pairs;
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {
      title: effectiveTitle,
      content: contentToStore,
      publication_status,
      scheduled_for,
      approval_status: approvalStatus,
      is_published: isPublished,
      published_at,
      updated_at: nowIso,
    };
    if (body.is_free !== undefined) {
      updates.is_free = body.is_free;
    }

    const { data: updated, error: updateError } = await supabase
      .from("circle_content")
      .update(updates)
      .eq("id", postId)
      .eq("circle_id", circleId)
      .select(
        `
        id,
        circle_id,
        author_id,
        title,
        content,
        content_type,
        is_free,
        is_published,
        is_pinned,
        approval_status,
        approved_by,
        approved_at,
        rejection_reason,
        view_count,
        like_count,
        downvote_count,
        comment_count,
        publication_status,
        scheduled_for,
        published_at,
        created_at,
        updated_at,
        shared_from,
        shared_by
      `
      )
      .single();

    if (updateError || !updated) {
      console.error("PATCH post:", updateError);
      return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (runMentions && serviceKey && mentionPairs && mentionPairs.length > 0) {
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId,
        contentId: postId,
        commentId: null,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[posts PATCH] mentions:", applyErr.error);
      }
    }

    if (isPublished && publication_status === "published" && serviceKey) {
      const adminDb = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: rpcError } = await adminDb.rpc("notify_circle_members_of_new_post", {
        p_content_id: postId,
      });
      if (rpcError) {
        console.error("[posts PATCH] RPC failed:", rpcError.message);
      }
    }

    const u = updated as unknown as {
      id: string;
      circle_id: string;
      author_id: string;
      title: string;
      content: string;
      content_type: string;
      is_free: boolean;
      is_published: boolean;
      is_pinned: boolean;
      approval_status: string;
      approved_by: string | null;
      approved_at: string | null;
      rejection_reason: string | null;
      view_count: number;
      like_count: number;
      downvote_count?: number;
      comment_count: number;
      publication_status: string;
      scheduled_for: string | null;
      published_at: string | null;
      created_at: string;
      updated_at: string;
      shared_from: unknown | null;
      shared_by: string | null;
    };

    const post: CircleContentWithAuthor = {
      id: u.id,
      circle_id: u.circle_id,
      author_id: u.author_id,
      title: u.title,
      content: u.content,
      content_type: u.content_type as CircleContentType,
      is_free: u.is_free,
      is_published: u.is_published,
      is_pinned: u.is_pinned,
      approval_status: u.approval_status as CircleContentApprovalStatus,
      approved_by: u.approved_by,
      approved_at: u.approved_at,
      rejection_reason: u.rejection_reason,
      view_count: u.view_count,
      like_count: u.like_count,
      downvote_count: u.downvote_count ?? 0,
      comment_count: u.comment_count,
      publication_status: u.publication_status as CircleContentPublicationStatus,
      scheduled_for: u.scheduled_for,
      published_at: u.published_at,
      created_at: u.created_at,
      updated_at: u.updated_at,
      shared_from: u.shared_from as CircleContentWithAuthor["shared_from"],
      shared_by: u.shared_by,
      author: { id: u.author_id, full_name: "", avatar_url: null },
      sharer: null,
    };

    return NextResponse.json({
      post,
      pending: approvalStatus === "pending",
    });
  } catch (err) {
    console.error("PATCH /api/circles/[id]/posts/[postId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circles/[id]/posts/[postId]
 * Author may delete their own draft or scheduled post (hard delete).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, postId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error: fetchError } = await supabase
      .from("circle_content")
      .select("id, author_id, publication_status, is_welcome_post, content_type")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const r = row as {
      author_id: string;
      publication_status: CircleContentPublicationStatus;
      is_welcome_post?: boolean;
      content_type: string;
    };

    if (r.author_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (r.is_welcome_post || r.content_type !== "post") {
      return NextResponse.json({ error: "Cannot delete this content here" }, { status: 400 });
    }
    if (r.publication_status !== "draft" && r.publication_status !== "scheduled") {
      return NextResponse.json({ error: "Only drafts and scheduled posts can be deleted here" }, { status: 400 });
    }

    const { error: delError } = await supabase.from("circle_content").delete().eq("id", postId).eq("circle_id", circleId);

    if (delError) {
      console.error("DELETE draft post:", delError);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/circles/[id]/posts/[postId]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
