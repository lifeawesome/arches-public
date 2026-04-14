import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";
import type { CircleCategory } from "@/types/circles";

/**
 * GET /api/admin/circle-categories
 * List all categories (including inactive) for admin UI. Administrator only.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profile = await getAppRBACProfile(supabase, user.id);
    if (!profile || !hasAppAccessLevel(profile.app_access_level, "administrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("circle_categories")
      .select("id, name, slug, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching circle categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    return NextResponse.json({ categories: (data || []) as CircleCategory[] });
  } catch (err) {
    console.error("GET /api/admin/circle-categories:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/circle-categories
 * Create a category. Administrator only.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profile = await getAppRBACProfile(supabase, user.id);
    if (!profile || !hasAppAccessLevel(profile.app_access_level, "administrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, sort_order = 0, is_active = true } = body as {
      name?: string;
      slug?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const finalSlug = (slug?.trim() || name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")) || "category";
    const { data: existing } = await supabase
      .from("circle_categories")
      .select("id")
      .eq("slug", finalSlug)
      .single();
    if (existing) {
      return NextResponse.json({ error: "A category with this slug already exists" }, { status: 409 });
    }

    const { data: category, error } = await supabase
      .from("circle_categories")
      .insert({
        name: name.trim(),
        slug: finalSlug,
        sort_order: Number(sort_order) || 0,
        is_active: Boolean(is_active),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating circle category:", error);
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/circle-categories:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
