import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CircleDirectoryItem, CircleVisibility } from "@/types/circles";

/**
 * GET /api/circles/featured
 * Public: returns featured public circles with stats and category.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("circles")
      .select(
        `
        *,
        profiles!circles_expert_id_profiles_fkey(id, full_name, avatar_url, expertise),
        circle_categories(id, name, slug, sort_order, is_active, created_at, updated_at)
      `
      )
      .eq("visibility", "public")
      .eq("is_active", true)
      .eq("status", "active")
      .eq("is_featured", true)
      .order("member_count", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Error fetching featured circles:", error);
      return NextResponse.json(
        { error: "Failed to fetch featured circles" },
        { status: 500 }
      );
    }

    const circles = (rows || []) as RawCircleRow[];
    const circleIds = circles.map((c) => c.id);
    const statsMap = await getStatsForCircles(supabase, circleIds);

    const items: CircleDirectoryItem[] = circles.map((c) => {
      const stats = statsMap[c.id] ?? { post_count: 0, total_view_count: 0, total_like_count: 0 };
      const expert = c.profiles
        ? {
            id: (c.profiles as { id: string }).id,
            full_name: (c.profiles as { full_name: string }).full_name ?? "",
            avatar_url: (c.profiles as { avatar_url: string | null }).avatar_url ?? null,
            expertise: (c.profiles as { expertise: string | null }).expertise ?? null,
          }
        : { id: c.expert_id, full_name: "", avatar_url: null, expertise: null };
      const category = c.circle_categories
        ? {
            id: (c.circle_categories as { id: string }).id,
            name: (c.circle_categories as { name: string }).name,
            slug: (c.circle_categories as { slug: string }).slug,
            sort_order: (c.circle_categories as { sort_order: number }).sort_order,
            is_active: (c.circle_categories as { is_active: boolean }).is_active,
            created_at: (c.circle_categories as { created_at: string }).created_at,
            updated_at: (c.circle_categories as { updated_at: string }).updated_at,
          }
        : null;
      const { profiles: _p, circle_categories: _cat, ...rest } = c;
      return {
        ...rest,
        visibility: c.visibility as CircleVisibility,
        expert,
        category,
        post_count: stats.post_count,
        total_view_count: stats.total_view_count,
        total_like_count: stats.total_like_count,
      } as CircleDirectoryItem;
    });

    return NextResponse.json({ featured: items });
  } catch (err) {
    console.error("GET /api/circles/featured:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

type RawCircleRow = {
  id: string;
  expert_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: string;
  category_id: string | null;
  is_featured: boolean;
  access_type: string;
  price_cents: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  member_count: number;
  settings: object;
  created_at: string;
  updated_at: string;
  profiles?: object | null;
  circle_categories?: object | null;
};

async function getStatsForCircles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  circleIds: string[]
): Promise<Record<string, { post_count: number; total_view_count: number; total_like_count: number }>> {
  if (circleIds.length === 0) return {};
  const { data, error } = await supabase
    .from("circle_content")
    .select("circle_id, view_count, like_count")
    .in("circle_id", circleIds);
  if (error)
    return circleIds.reduce(
      (acc, id) => ({ ...acc, [id]: { post_count: 0, total_view_count: 0, total_like_count: 0 } }),
      {}
    );
  const map: Record<string, { post_count: number; total_view_count: number; total_like_count: number }> = {};
  for (const id of circleIds) {
    map[id] = { post_count: 0, total_view_count: 0, total_like_count: 0 };
  }
  for (const row of data || []) {
    const r = row as { circle_id: string; view_count: number; like_count: number };
    if (!map[r.circle_id]) continue;
    map[r.circle_id].post_count += 1;
    map[r.circle_id].total_view_count += r.view_count ?? 0;
    map[r.circle_id].total_like_count += r.like_count ?? 0;
  }
  return map;
}
