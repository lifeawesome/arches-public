import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle, canCreateCirclePost } from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import type { CircleContentPublicationStatus, CircleContentWithAuthor, CircleContentType } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/posts/drafts
 * Lists the current user's draft and scheduled posts in this circle (RLS: author only).
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

    const canAccess = await canAccessCircle(circleId, user.id);
    if (!canAccess) {
      return jsonCircleAccessForbidden(circleId, user.id);
    }

    const canPost = await canCreateCirclePost(circleId, user.id);
    if (!canPost) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from("circle_content")
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
      .eq("circle_id", circleId)
      .eq("author_id", user.id)
      .eq("content_type", "post" as CircleContentType)
      .in("publication_status", ["draft", "scheduled"] as CircleContentPublicationStatus[])
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("GET posts/drafts:", error);
      return NextResponse.json({ error: "Failed to load drafts" }, { status: 500 });
    }

    const list = (rows ?? []) as unknown as Array<{
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
      publication_status: CircleContentPublicationStatus;
      scheduled_for: string | null;
      published_at: string | null;
      created_at: string;
      updated_at: string;
      shared_from: unknown | null;
      shared_by: string | null;
    }>;

    const posts: CircleContentWithAuthor[] = list.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      author_id: r.author_id,
      title: r.title,
      content: r.content,
      content_type: r.content_type as CircleContentType,
      is_free: r.is_free,
      is_published: r.is_published,
      is_pinned: r.is_pinned,
      approval_status: r.approval_status as CircleContentWithAuthor["approval_status"],
      approved_by: r.approved_by,
      approved_at: r.approved_at,
      rejection_reason: r.rejection_reason,
      view_count: r.view_count,
      like_count: r.like_count,
      downvote_count: r.downvote_count ?? 0,
      comment_count: r.comment_count,
      publication_status: r.publication_status,
      scheduled_for: r.scheduled_for,
      published_at: r.published_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      shared_from: r.shared_from as CircleContentWithAuthor["shared_from"],
      shared_by: r.shared_by,
      author: { id: r.author_id, full_name: "", avatar_url: null },
      sharer: null,
    }));

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("GET /api/circles/[id]/posts/drafts:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
