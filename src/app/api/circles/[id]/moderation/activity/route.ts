import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canModerateContent } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

/**
 * GET /api/circles/[id]/moderation/activity
 * Paginated activity log for the circle. Moderators/owners only.
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

    const canView = await canModerateContent(circleId, user.id);
    if (!canView) {
      return NextResponse.json(
        { error: "Only moderators and owners can view the activity log" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const perPageRaw = parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data: entries, error, count } = await supabase
      .from("circle_moderation_activity_log")
      .select(
        `
        id,
        circle_id,
        actor_id,
        action,
        target_type,
        target_id,
        metadata,
        created_at
        `,
        { count: "exact" }
      )
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching activity log:", error);
      return NextResponse.json(
        { error: "Failed to load activity log", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      activity: entries ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/moderation/activity:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
