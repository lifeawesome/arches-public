import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isCircleOwner } from "@/lib/utils/circles/access-control";
import {
  loadCircleContentAnalyticsRows,
  loadPeerAnalyticsSummaries,
  summarizeCircleContent,
  type CircleAnalyticsWindow,
} from "@/lib/utils/circles/analytics";
import type { CircleAnalyticsContentRow, CircleAnalyticsResponse } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

function parseWindow(request: NextRequest): CircleAnalyticsWindow {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  return { from, to };
}

/**
 * GET /api/circles/[id]/analytics
 * Circle owner only. Aggregated engagement for posts/polls with optional published_at window.
 * Query: from, to (ISO dates), include_peers=1 (other circles by same expert).
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

    const owner = await isCircleOwner(circleId, user.id);
    if (!owner) {
      return NextResponse.json({ error: "Only the circle owner can view analytics" }, { status: 403 });
    }

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id, name, member_count, expert_id")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const c = circle as { id: string; name: string; member_count: number; expert_id: string };
    const window = parseWindow(request);
    const rows = await loadCircleContentAnalyticsRows(supabase, circleId);
    const analytics = summarizeCircleContent(rows, c.id, c.name, c.member_count ?? 0, window);

    const includePeers = request.nextUrl.searchParams.get("include_peers") === "1";
    let peer_circles: CircleAnalyticsResponse["peer_circles"];

    if (includePeers) {
      peer_circles = await loadPeerAnalyticsSummaries(supabase, c.expert_id, circleId, window);
      if (peer_circles.length === 0) {
        peer_circles = undefined;
      }
    }

    const body: CircleAnalyticsResponse = { analytics, peer_circles };
    return NextResponse.json(body);
  } catch (err) {
    console.error("GET /api/circles/[id]/analytics:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
