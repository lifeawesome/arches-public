import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle } from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";
import { getCircleContentStatsForIds } from "@/lib/utils/circles/get-circle-content-stats";
import type { CircleDirectoryItem, CircleVisibility } from "@/types/circles";

type RouteParams = { params: Promise<{ slug: string }> };

/** Accept legacy URLs that used circle UUID in the first path segment. */
function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * GET /api/circles/by-slug/[slug]
 * Returns a single circle by slug with category, expert, and stats.
 * Visibility and access are enforced by RLS: public circles are visible to everyone,
 * private circles are only visible to owners and active members.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug required" }, { status: 400 });
    }

    const supabase = await createClient();
    const selectCircle = `
        *,
        profiles!circles_expert_id_profiles_fkey(id, full_name, avatar_url, expertise),
        circle_categories(id, name, slug, sort_order, is_active, created_at, updated_at)
      `;

    let { data: row, error } = await supabase
      .from("circles")
      .select(selectCircle)
      .eq("slug", slug.trim())
      .maybeSingle();

    if ((error || !row) && isUuidLike(slug)) {
      const byId = await supabase.from("circles").select(selectCircle).eq("id", slug.trim()).maybeSingle();
      row = byId.data;
      error = byId.error;
    }

    if (error || !row) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const c = row as RawCircleRow;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const allowed = await canAccessCircle(c.id, user?.id ?? null);
    if (!allowed) {
      return jsonCircleAccessForbidden(c.id, user?.id);
    }

    const statsMap = await getCircleContentStatsForIds(supabase, [c.id]);
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

    const rest = { ...c };
    delete (rest as Partial<RawCircleRow>).profiles;
    delete (rest as Partial<RawCircleRow>).circle_categories;
    const item: CircleDirectoryItem = {
      ...rest,
      visibility: c.visibility as CircleVisibility,
      expert,
      category,
      post_count: stats.post_count,
      total_view_count: stats.total_view_count,
      total_like_count: stats.total_like_count,
    } as CircleDirectoryItem;

    return NextResponse.json({ circle: item });
  } catch (err) {
    console.error("GET /api/circles/by-slug/[slug]:", err);
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
