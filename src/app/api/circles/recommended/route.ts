import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CircleDirectoryItem, CircleVisibility } from "@/types/circles";

type MembershipRow = { circle_id: string };
type JoinedCircleRow = { id: string; category_id: string | null };
type ProfileRow = { id: string; full_name: string | null; avatar_url: string | null; expertise: string | null };
type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type CircleRowWithRelations = {
  id: string;
  expert_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: CircleVisibility;
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
  profiles?: ProfileRow | null;
  circle_categories?: CategoryRow | null;
};

/**
 * GET /api/circles/recommended
 * Returns recommended circles (personalized when authenticated; fallback to popular public circles).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const limit = 12;

    if (!user) {
      const fallback = await getPopularPublicCircles(supabase, limit);
      return NextResponse.json({ recommended: fallback });
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("circle_memberships")
      .select("circle_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipError) {
      console.error("Error fetching memberships for recommendations:", membershipError);
      const fallback = await getPopularPublicCircles(supabase, limit);
      return NextResponse.json({ recommended: fallback });
    }

    const joinedCircleIds = [
      ...new Set(((memberships ?? []) as MembershipRow[]).map((m) => m.circle_id)),
    ];
    if (joinedCircleIds.length === 0) {
      const fallback = await getPopularPublicCircles(supabase, limit);
      return NextResponse.json({ recommended: fallback });
    }

    const { data: joinedCircles } = await supabase
      .from("circles")
      .select("id, category_id")
      .in("id", joinedCircleIds);

    const categoryIds = [
      ...new Set(
        ((joinedCircles ?? []) as JoinedCircleRow[]).map((c) => c.category_id).filter(Boolean)
      ),
    ] as string[];
    if (categoryIds.length === 0) {
      const fallback = await getPopularPublicCircles(supabase, limit);
      return NextResponse.json({ recommended: fallback });
    }

    // Supabase filter syntax for NOT IN can be brittle across versions.
    // Fetch a larger candidate set then exclude joined circles in memory.
    const { data: candidateRows, error } = await supabase
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
      .in("category_id", categoryIds)
      .order("is_featured", { ascending: false })
      .order("member_count", { ascending: false })
      .limit(Math.max(limit * 5, 50));

    if (error) {
      console.error("Error fetching recommended circles:", error);
      const fallback = await getPopularPublicCircles(supabase, limit);
      return NextResponse.json({ recommended: fallback });
    }

    const candidates = (candidateRows ?? []) as unknown as CircleRowWithRelations[];
    const rows = candidates.filter((c) => !joinedCircleIds.includes(c.id)).slice(0, limit);
    const ids = rows.map((c) => c.id);
    const statsMap = await getStatsForCircles(supabase, ids);
    const recommended = rows.map((c) => mapCircleRowToDirectoryItem(c, statsMap[c.id]));

    return NextResponse.json({ recommended });
  } catch (err) {
    console.error("GET /api/circles/recommended:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

async function getPopularPublicCircles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit: number
): Promise<CircleDirectoryItem[]> {
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
    .order("is_featured", { ascending: false })
    .order("member_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching popular circles fallback:", error);
    return [];
  }

  const typedRows = (rows ?? []) as unknown as CircleRowWithRelations[];
  const ids = typedRows.map((c) => c.id);
  const statsMap = await getStatsForCircles(supabase, ids);
  return typedRows.map((c) => mapCircleRowToDirectoryItem(c, statsMap[c.id]));
}

function mapCircleRowToDirectoryItem(
  c: CircleRowWithRelations,
  stats?: { post_count: number; total_view_count: number; total_like_count: number }
): CircleDirectoryItem {
  const s = stats ?? { post_count: 0, total_view_count: 0, total_like_count: 0 };
  const expert = c.profiles
    ? {
        id: c.profiles.id as string,
        full_name: (c.profiles.full_name ?? "") as string,
        avatar_url: (c.profiles.avatar_url ?? null) as string | null,
        expertise: (c.profiles.expertise ?? null) as string | null,
      }
    : { id: c.expert_id as string, full_name: "", avatar_url: null, expertise: null };
  const category = c.circle_categories
    ? {
        id: c.circle_categories.id as string,
        name: c.circle_categories.name as string,
        slug: c.circle_categories.slug as string,
        sort_order: c.circle_categories.sort_order as number,
        is_active: c.circle_categories.is_active as boolean,
        created_at: c.circle_categories.created_at as string,
        updated_at: c.circle_categories.updated_at as string,
      }
    : null;
  return {
    id: c.id,
    expert_id: c.expert_id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    cover_image_url: c.cover_image_url,
    visibility: c.visibility,
    category_id: c.category_id,
    is_featured: !!c.is_featured,
    access_type: c.access_type as CircleDirectoryItem["access_type"],
    price_cents: c.price_cents,
    stripe_product_id: c.stripe_product_id,
    stripe_price_id: c.stripe_price_id,
    is_active: !!c.is_active,
    member_count: c.member_count ?? 0,
    settings: c.settings as CircleDirectoryItem["settings"],
    expert,
    category,
    post_count: s.post_count,
    total_view_count: s.total_view_count,
    total_like_count: s.total_like_count,
  } as CircleDirectoryItem;
}

async function getStatsForCircles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  circleIds: string[]
): Promise<Record<string, { post_count: number; total_view_count: number; total_like_count: number }>> {
  if (circleIds.length === 0) return {};
  const { data, error } = await supabase
    .from("circle_content")
    .select("circle_id, view_count, like_count")
    .in("circle_id", circleIds)
    .eq("is_published", true);
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

