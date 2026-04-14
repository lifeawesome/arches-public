import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/circle-categories/[id]
 * Update a category. Administrator only.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const { name, slug, sort_order, is_active } = body as {
      name?: string;
      slug?: string;
      sort_order?: number;
      is_active?: boolean;
    };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (slug !== undefined) updates.slug = slug.trim();
    if (sort_order !== undefined) updates.sort_order = Number(sort_order) ?? 0;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      const { data } = await supabase.from("circle_categories").select("*").eq("id", id).single();
      return NextResponse.json({ category: data });
    }

    if (slug !== undefined) {
      const { data: existing } = await supabase
        .from("circle_categories")
        .select("id")
        .eq("slug", slug.trim())
        .neq("id", id)
        .single();
      if (existing) {
        return NextResponse.json(
          { error: "A category with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const { data: category, error } = await supabase
      .from("circle_categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating circle category:", error);
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category });
  } catch (err) {
    console.error("PATCH /api/admin/circle-categories/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
