import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canModerateContent } from "@/lib/utils/circles/access-control";
import type { CircleContentType } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

/**
 * GET /api/circles/[id]/moderation/pending
 * Returns pending content (approval_status = 'pending') for moderators/owners.
 * Ordered oldest-first so moderators process posts in submission order.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
      return NextResponse.json({ error: "Only moderators and owners can view the moderation queue" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const perPageRaw = parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await supabase
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
        comment_count,
        published_at,
        created_at,
        updated_at
        `,
        { count: "exact" }
      )
      .eq("circle_id", circleId)
      .eq("approval_status", "pending")
      .eq("publication_status", "published")
      .in("content_type", ["post", "poll"] as CircleContentType[])
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Error fetching pending moderation queue:", error);
      return NextResponse.json({ error: "Failed to load moderation queue" }, { status: 500 });
    }

    return NextResponse.json({
      content: data ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/moderation/pending:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
