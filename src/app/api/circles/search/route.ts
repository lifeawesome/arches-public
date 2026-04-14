import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isUuid, normalizeQuery, clampInt } from "@/lib/circles/search-utils";
import type {
  CircleDirectoryItem,
  CircleSearchResponse,
  CircleSearchResult,
  CircleVisibility,
} from "@/types/circles";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

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
 * GET /api/circles/search
 * Search circles by name/description/slug and circle_content (full-text).
 * Query: q, category (id or slug), visibility (public|private), min_members, max_members, page, per_page
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const q = normalizeQuery(searchParams.get("q"));
    const categoryParam = searchParams.get("category");
    const visibilityParam = (searchParams.get("visibility")?.trim() || "") as CircleVisibility | "";

    const minMembersRaw = searchParams.get("min_members");
    const maxMembersRaw = searchParams.get("max_members");
    const min_members = minMembersRaw ? Math.max(0, parseInt(minMembersRaw, 10)) : null;
    const max_members = maxMembersRaw ? Math.max(0, parseInt(maxMembersRaw, 10)) : null;

    const page = clampInt(searchParams.get("page"), DEFAULT_PAGE, 1, 10_000);
    const per_page = clampInt(searchParams.get("per_page"), DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);
    const offset = (page - 1) * per_page;

    let category_id: string | null = null;
    if (categoryParam?.trim()) {
      if (isUuid(categoryParam)) {
        category_id = categoryParam;
      } else {
        const { data: cat } = await supabase
          .from("circle_categories")
          .select("id")
          .eq("slug", categoryParam.trim())
          .eq("is_active", true)
          .single();
        if (cat) category_id = (cat as { id: string }).id;
      }
    }

    const visibility: CircleVisibility | null =
      visibilityParam === "public" || visibilityParam === "private" ? visibilityParam : null;

    const { data: searchRows, error: searchError } = await supabase.rpc("circle_search", {
      p_query: q || null,
      p_category_id: category_id,
      p_visibility: visibility,
      p_min_members: min_members,
      p_max_members: max_members,
      p_limit: per_page,
      p_offset: offset,
    });

    if (searchError) {
      console.error("Error searching circles:", searchError);
      return NextResponse.json({ error: "Failed to search circles" }, { status: 500 });
    }

    const rows = (searchRows ?? []) as Array<{
      id: string;
      post_count: number;
      total_view_count: number;
      total_like_count: number;
      score: number;
      total_count: number;
    }>;

    const circleIds = rows.map((r) => r.id);
    if (circleIds.length === 0) {
      const empty: CircleSearchResponse = { results: [], total: 0, page, per_page };
      return NextResponse.json(empty);
    }

    const { data: circleRows, error: circleError } = await supabase
      .from("circles")
      .select(
        `
        *,
        profiles!circles_expert_id_profiles_fkey(id, full_name, avatar_url, expertise),
        circle_categories(id, name, slug, sort_order, is_active, created_at, updated_at)
      `
      )
      .in("id", circleIds)
      .eq("status", "active");

    if (circleError) {
      console.error("Error fetching circle details for search:", circleError);
      return NextResponse.json({ error: "Failed to search circles" }, { status: 500 });
    }

    const circleMap = new Map<string, CircleRowWithRelations>(
      (circleRows ?? []).map((c) => {
        const row = c as unknown as CircleRowWithRelations;
        return [row.id, row];
      })
    );

    const results: CircleSearchResult[] = rows
      .map((r) => {
        const c = circleMap.get(r.id);
        if (!c) return null;
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

        const base: CircleDirectoryItem = {
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
          created_at: c.created_at,
          updated_at: c.updated_at,
          expert,
          category,
          post_count: r.post_count ?? 0,
          total_view_count: r.total_view_count ?? 0,
          total_like_count: r.total_like_count ?? 0,
        } as CircleDirectoryItem;

        return { ...base, score: Number(r.score ?? 0) } as CircleSearchResult;
      })
      .filter(Boolean) as CircleSearchResult[];

    const total = Number(rows[0]?.total_count ?? results.length) || 0;
    const response: CircleSearchResponse = { results, total, page, per_page };
    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/circles/search:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

