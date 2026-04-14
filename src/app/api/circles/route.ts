import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CreateCircleInput } from "@/types/circles";

/**
 * POST /api/circles
 * Create a circle. Auth required; user must be expert. Public circles require category_id.
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_expert")
      .eq("id", user.id)
      .single();
    if (!profile?.is_expert) {
      return NextResponse.json(
        { error: "Only experts can create circles" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateCircleInput;
    const {
      name,
      slug,
      description,
      cover_image_url,
      visibility = "private",
      category_id,
      access_type = "free",
      price_cents,
      settings,
    } = body;

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    if (visibility === "public") {
      if (!category_id?.trim()) {
        return NextResponse.json(
          { error: "Public circles must have a category" },
          { status: 400 }
        );
      }
      const { data: cat } = await supabase
        .from("circle_categories")
        .select("id")
        .eq("id", category_id)
        .eq("is_active", true)
        .single();
      if (!cat) {
        return NextResponse.json(
          { error: "Invalid or inactive category" },
          { status: 400 }
        );
      }
    }

    const mergedSettings = {
      ...(settings ?? {}),
      who_can_invite: (settings as { who_can_invite?: string })?.who_can_invite ?? "moderators_only",
    };
    const { data: circle, error } = await supabase
      .from("circles")
      .insert({
        expert_id: user.id,
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() ?? null,
        cover_image_url: cover_image_url?.trim() || null,
        visibility,
        category_id: visibility === "public" ? category_id! : null,
        is_featured: false,
        access_type,
        price_cents: access_type === "paid" ? price_cents ?? null : null,
        settings: mergedSettings,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A circle with this slug already exists" }, { status: 409 });
      }
      console.error("Error creating circle:", error);
      return NextResponse.json(
        { error: "Failed to create circle" },
        { status: 500 }
      );
    }

    return NextResponse.json({ circle }, { status: 201 });
  } catch (err) {
    console.error("POST /api/circles:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
