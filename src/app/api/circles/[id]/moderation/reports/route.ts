import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canViewReports } from "@/lib/utils/circles/access-control";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

/**
 * GET /api/circles/[id]/moderation/reports
 * List reports for the circle. Moderators/owners only. Query: status=pending|resolved|dismissed, page, per_page.
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

    const canView = await canViewReports(circleId, user.id);
    if (!canView) {
      return NextResponse.json(
        { error: "Only moderators and owners can view reports" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as "pending" | "resolved" | "dismissed" | null;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const perPageRaw = parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from("circle_reports")
      .select(
        `
        id,
        circle_id,
        reporter_id,
        reported_content_id,
        reported_comment_id,
        reason,
        description,
        reason_text,
        status,
        resolved_by,
        resolved_at,
        created_at
        `,
        { count: "exact" }
      )
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status && ["pending", "resolved", "dismissed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: reports, error, count } = await query;

    if (error) {
      return upstreamError(
        "GET /api/circles/[id]/moderation/reports",
        "Failed to load reports",
        error
      );
    }

    return NextResponse.json({
      reports: reports ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (err) {
    return internalServerError("GET /api/circles/[id]/moderation/reports:", err);
  }
}
