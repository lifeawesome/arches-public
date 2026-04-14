import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CircleAnalyticsContentRow,
  CircleAnalyticsPeerSummary,
  CircleAnalyticsSummary,
  CircleContentApprovalStatus,
  CircleContentType,
} from "@/types/circles";

type ContentRow = {
  id: string;
  title: string;
  content_type: CircleContentType;
  approval_status: CircleContentApprovalStatus;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  published_at: string | null;
  created_at: string;
  is_deleted?: boolean | null;
};

export type CircleAnalyticsWindow = { from: string | null; to: string | null };

function isFeedType(t: string): t is "post" | "poll" {
  return t === "post" || t === "poll";
}

function notDeleted(row: { is_deleted?: boolean | null }): boolean {
  return row.is_deleted !== true;
}

function inPublishedWindow(publishedAt: string | null, window: CircleAnalyticsWindow): boolean {
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
}

function rowToAnalyticsRow(r: ContentRow): CircleAnalyticsContentRow {
  return {
    id: r.id,
    title: r.title,
    content_type: r.content_type,
    approval_status: r.approval_status,
    view_count: r.view_count ?? 0,
    like_count: r.like_count ?? 0,
    comment_count: r.comment_count ?? 0,
    published_at: r.published_at,
    created_at: r.created_at,
  };
}

export async function loadCircleContentAnalyticsRows(
  supabase: SupabaseClient,
  circleId: string
): Promise<ContentRow[]> {
  const { data, error } = await supabase
    .from("circle_content")
    .select(
      "id, title, content_type, approval_status, view_count, like_count, comment_count, published_at, created_at, is_deleted"
    )
    .eq("circle_id", circleId)
    .in("content_type", ["post", "poll"]);

  if (error) {
    console.error("loadCircleContentAnalyticsRows:", error);
    throw new Error(error.message);
  }

  return (data ?? []) as ContentRow[];
}

export function summarizeCircleContent(
  rows: ContentRow[],
  circleId: string,
  circleName: string,
  memberCount: number,
  window: CircleAnalyticsWindow
): CircleAnalyticsSummary {
  const feedRows = rows.filter((r) => isFeedType(r.content_type) && notDeleted(r));

  const by_approval = { approved: 0, pending: 0, rejected: 0 };
  for (const r of feedRows) {
    if (r.approval_status === "approved") by_approval.approved += 1;
    else if (r.approval_status === "pending") by_approval.pending += 1;
    else if (r.approval_status === "rejected") by_approval.rejected += 1;
  }

  const engagementRows = feedRows.filter(
    (r) => r.approval_status === "approved" && inPublishedWindow(r.published_at, window)
  );

  const totals = engagementRows.reduce(
    (acc, r) => ({
      view_count: acc.view_count + (r.view_count ?? 0),
      like_count: acc.like_count + (r.like_count ?? 0),
      comment_count: acc.comment_count + (r.comment_count ?? 0),
    }),
    { view_count: 0, like_count: 0, comment_count: 0 }
  );

  const top_by_views = [...engagementRows]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 20)
    .map(rowToAnalyticsRow);

  return {
    circle_id: circleId,
    circle_name: circleName,
    member_count: memberCount,
    content_items_count: engagementRows.length,
    totals,
    by_approval,
    top_by_views,
    window,
    generated_at: new Date().toISOString(),
  };
}

export async function loadPeerAnalyticsSummaries(
  supabase: SupabaseClient,
  expertId: string,
  excludeCircleId: string,
  window: CircleAnalyticsWindow
): Promise<CircleAnalyticsPeerSummary[]> {
  const { data: circles, error } = await supabase
    .from("circles")
    .select("id, name, slug, member_count")
    .eq("expert_id", expertId)
    .neq("id", excludeCircleId)
    .eq("is_active", true);

  if (error || !circles?.length) {
    return [];
  }

  const peers: CircleAnalyticsPeerSummary[] = [];

  for (const c of circles as { id: string; name: string; slug: string; member_count: number }[]) {
    const rows = await loadCircleContentAnalyticsRows(supabase, c.id);
    const s = summarizeCircleContent(rows, c.id, c.name, c.member_count ?? 0, window);
    peers.push({
      circle_id: c.id,
      name: c.name,
      slug: c.slug,
      member_count: c.member_count ?? 0,
      totals: s.totals,
      content_items_count: s.content_items_count,
    });
  }

  return peers.sort((a, b) => b.totals.view_count - a.totals.view_count);
}

export function analyticsRowsToCsv(rows: CircleAnalyticsContentRow[]): string {
  const header = [
    "id",
    "title",
    "content_type",
    "approval_status",
    "view_count",
    "like_count",
    "comment_count",
    "published_at",
    "created_at",
  ];
  const esc = (v: string) => {
    let s = v;
    // Mitigate CSV/formula injection in Excel/Sheets (leading =, +, -, @, tab, CR)
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `'${s}`;
    }
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        esc(r.title),
        r.content_type,
        r.approval_status,
        String(r.view_count),
        String(r.like_count),
        String(r.comment_count),
        r.published_at ?? "",
        r.created_at,
      ].join(",")
    );
  }
  return lines.join("\r\n");
}
