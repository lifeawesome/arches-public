import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CircleCategory } from "@/types/circles";

/**
 * GET /api/circles/categories
 * Public: returns active circle categories for directory filters and circle forms.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("circle_categories")
      .select("id, name, slug, sort_order, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching circle categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      categories: (data || []) as CircleCategory[],
    });
  } catch (err) {
    console.error("GET /api/circles/categories:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
