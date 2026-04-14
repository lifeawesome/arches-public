import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { canCommentOnContent } from "@/lib/utils/circles/access-control";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  markdownLimits,
  normalizeMarkdownInput,
} from "@/lib/utils/markdown";
import { extractMentionHandles } from "@/lib/circles/mentions";
import { applyMentionsAfterContentSave, validateCircleMentionText } from "@/lib/circles/mention-sync";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

/**
 * GET /api/circles/[id]/content/[contentId]/comments
 * List non-deleted comments for the content. RLS and is_deleted filter applied.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canComment = await canCommentOnContent(contentId, user.id);
    if (!canComment) {
      return NextResponse.json(
        { error: "You do not have access to view comments for this content" },
        { status: 403 }
      );
    }

    const { data: content } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .single();

    if (!content || (content as { circle_id: string }).circle_id !== circleId) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const { data: comments, error } = await supabase
      .from("circle_comments")
      .select(
        `
        id,
        content_id,
        user_id,
        comment_text,
        parent_comment_id,
        like_count,
        downvote_count,
        is_deleted,
        created_at,
        updated_at
        `
      )
      .eq("content_id", contentId)
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return NextResponse.json(
        { error: "Failed to load comments", details: error.message },
        { status: 500 }
      );
    }

    const list = comments ?? [];
    const userIds = [...new Set(list.map((c) => (c as { user_id: string }).user_id))];
    let profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          { full_name: p.full_name ?? "", avatar_url: p.avatar_url ?? null },
        ])
      );
    }

    const commentsWithAuthor = list.map((c) => {
      const row = c as {
        id: string;
        content_id: string;
        user_id: string;
        comment_text: string;
        parent_comment_id: string | null;
        like_count: number;
        downvote_count?: number;
        is_deleted: boolean | null;
        created_at: string;
        updated_at: string;
      };
      const p = profileMap.get(row.user_id);
      return {
        ...row,
        downvote_count: row.downvote_count ?? 0,
        author: {
          id: row.user_id,
          full_name: p?.full_name ?? "",
          avatar_url: p?.avatar_url ?? null,
        },
      };
    });

    return NextResponse.json({ comments: commentsWithAuthor });
  } catch (err) {
    console.error("GET comments:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/circles/[id]/content/[contentId]/comments
 * Create a comment (optional parent for threading).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canComment = await canCommentOnContent(contentId, user.id);
    if (!canComment) {
      return NextResponse.json(
        { error: "You do not have access to comment on this content" },
        { status: 403 }
      );
    }

    const { data: contentRow } = await supabase
      .from("circle_content")
      .select("circle_id")
      .eq("id", contentId)
      .single();

    if (!contentRow || (contentRow as { circle_id: string }).circle_id !== circleId) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const body = (await request.json()) as { comment_text?: string; parent_comment_id?: string | null };
    const raw = normalizeMarkdownInput(body.comment_text ?? "");
    if (!raw || !hasRenderableMarkdownContent(raw)) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
    }
    const lenErr = enforceMarkdownLength(raw, markdownLimits.maxLength);
    if (lenErr) {
      return NextResponse.json({ error: lenErr }, { status: 400 });
    }

    let commentText = raw;
    let mentionPairs: { username: string; userId: string }[] | null = null;
    if (extractMentionHandles(raw).length > 0) {
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
        text: raw,
        authorId: user.id,
      });
      if (!mentionPrep.ok) {
        return NextResponse.json({ error: mentionPrep.error }, { status: mentionPrep.status });
      }
      commentText = mentionPrep.rewrittenText;
      mentionPairs = mentionPrep.pairs;
    }

    const parentId = body.parent_comment_id?.trim() || null;
    if (parentId) {
      const { data: parent } = await supabase
        .from("circle_comments")
        .select("id, content_id")
        .eq("id", parentId)
        .eq("content_id", contentId)
        .maybeSingle();
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("circle_comments")
      .insert({
        content_id: contentId,
        user_id: user.id,
        comment_text: commentText,
        parent_comment_id: parentId,
      })
      .select(
        "id, content_id, user_id, comment_text, parent_comment_id, like_count, downvote_count, is_deleted, created_at, updated_at"
      )
      .single();

    if (insErr || !inserted) {
      console.error("POST comment:", insErr);
      return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
    }

    const commentId = (inserted as { id: string }).id;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && mentionPairs && mentionPairs.length > 0) {
      const mentionAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const applyErr = await applyMentionsAfterContentSave({
        admin: mentionAdmin,
        circleId,
        contentId,
        commentId,
        authorId: user.id,
        pairs: mentionPairs,
      });
      if (applyErr.error) {
        console.error("[comments] mentions:", applyErr.error);
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      comment: {
        ...(inserted as object),
        author: {
          id: user.id,
          full_name: (profile as { full_name?: string } | null)?.full_name ?? "",
          avatar_url: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
        },
      },
    });
  } catch (err) {
    console.error("POST comments:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
