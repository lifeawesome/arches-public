import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isCircleOwner } from "@/lib/utils/circles/access-control";
import {
  analyticsRowsToCsv,
  loadCircleContentAnalyticsRows,
  summarizeCircleContent,
  type CircleAnalyticsWindow,
} from "@/lib/utils/circles/analytics";
import type { CircleAnalyticsContentRow } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

function parseWindow(request: NextRequest): CircleAnalyticsWindow {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  return { from, to };
}

/**
 * GET /api/circles/[id]/analytics/export?format=csv
 * Circle owner only. CSV of per-content metrics (posts/polls, non-deleted).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    if (format !== "csv") {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owner = await isCircleOwner(circleId, user.id);
    if (!owner) {
      return NextResponse.json({ error: "Only the circle owner can export analytics" }, { status: 403 });
    }

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id, name, slug, member_count")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const c = circle as { id: string; name: string; slug: string; member_count: number };
    const window = parseWindow(request);
    const rawRows = await loadCircleContentAnalyticsRows(supabase, circleId);

    const inWindow = (publishedAt: string | null) => {
      if (!window.from && !window.to) return true;
      if (!publishedAt) return false;
      const t = new Date(publishedAt).getTime();
      if (window.from) {
        const f = new Date(window.from).getTime();
        if (Number.isFinite(f) && t < f) return false;
      }
      if (window.to) {
        const end = new Date(window.to).getTime();
        if (Number.isFinite(end) && t > end) return false;
      }
      return true;
    };

    const exportRows: CircleAnalyticsContentRow[] = rawRows
      .filter((r) => r.content_type === "post" || r.content_type === "poll")
      .filter((r) => r.is_deleted !== true)
      .filter((r) => r.approval_status === "approved" && inWindow(r.published_at))
      .map((r) => ({
        id: r.id,
        title: r.title,
        content_type: r.content_type,
        approval_status: r.approval_status,
        view_count: r.view_count ?? 0,
        like_count: r.like_count ?? 0,
        comment_count: r.comment_count ?? 0,
        published_at: r.published_at,
        created_at: r.created_at,
      }));

    const summary = summarizeCircleContent(rawRows, c.id, c.name, c.member_count ?? 0, window);
    const summaryLine =
      "# summary," +
      [
        summary.circle_id,
        summary.totals.view_count,
        summary.totals.like_count,
        summary.totals.comment_count,
        summary.member_count,
        summary.content_items_count,
      ].join(",");

    const csv = summaryLine + "\r\n" + analyticsRowsToCsv(exportRows);
    const safeSlug = (c.slug || "circle").replace(/[^a-zA-Z0-9-_]+/g, "_");
    const filename = `circle-${safeSlug}-analytics.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/analytics/export:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
