import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CircleSearchSuggestion, CircleSearchSuggestionsResponse, CircleVisibility } from "@/types/circles";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

/**
 * GET /api/circles/search/suggestions
 * Prefix suggestions for circle names/slugs.
 * Query: q, limit
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10))
    );

    if (!q || q.length < 2) {
      const resp: CircleSearchSuggestionsResponse = { suggestions: [] };
      return NextResponse.json(resp);
    }

    const { data, error } = await supabase.rpc("circle_search_suggestions", {
      p_prefix: q,
      p_limit: limit,
    });

    if (error) {
      console.error("Error fetching circle suggestions:", error);
      return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      category_id: string | null;
      visibility: CircleVisibility;
      member_count: number;
    }>;

    const categoryIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))] as string[];
    const categoryMap = new Map<string, { id: string; name: string; slug: string }>();
    if (categoryIds.length > 0) {
      const { data: cats } = await supabase
        .from("circle_categories")
        .select("id, name, slug")
        .in("id", categoryIds)
        .eq("is_active", true);
      for (const c of cats ?? []) {
        const cat = c as { id: string; name: string; slug: string };
        categoryMap.set(cat.id, cat);
      }
    }

    const suggestions: CircleSearchSuggestion[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      visibility: r.visibility,
      member_count: r.member_count ?? 0,
      category: r.category_id ? categoryMap.get(r.category_id) ?? null : null,
    }));

    const resp: CircleSearchSuggestionsResponse = { suggestions };
    return NextResponse.json(resp);
  } catch (err) {
    console.error("GET /api/circles/search/suggestions:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

