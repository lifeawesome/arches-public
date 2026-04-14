import type { SupabaseClient } from "@supabase/supabase-js";

export type CircleContentStatsRollup = {
  post_count: number;
  total_view_count: number;
  total_like_count: number;
};

/**
 * Aggregates per-circle post count (excluding welcome posts), total views, and likes
 * from circle_content. Matches public circle-by-slug stats semantics.
 */
export async function getCircleContentStatsForIds(
  supabase: SupabaseClient,
  circleIds: string[]
): Promise<Record<string, CircleContentStatsRollup>> {
  if (circleIds.length === 0) return {};

  const { data, error } = await supabase
    .from("circle_content")
    .select("circle_id, view_count, like_count, is_welcome_post")
    .in("circle_id", circleIds);

  if (error) {
    return Object.fromEntries(
      circleIds.map((id) => [id, { post_count: 0, total_view_count: 0, total_like_count: 0 }])
    );
  }

  const map: Record<string, CircleContentStatsRollup> = {};
  for (const id of circleIds) {
    map[id] = { post_count: 0, total_view_count: 0, total_like_count: 0 };
  }
  for (const row of data || []) {
    const r = row as {
      circle_id: string;
      view_count: number;
      like_count: number;
      is_welcome_post?: boolean;
    };
    if (r.is_welcome_post) continue;
    if (!map[r.circle_id]) continue;
    map[r.circle_id].post_count += 1;
    map[r.circle_id].total_view_count += r.view_count ?? 0;
    map[r.circle_id].total_like_count += r.like_count ?? 0;
  }
  return map;
}
