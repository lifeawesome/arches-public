import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canInviteMembers } from "@/lib/utils/circles/access-control";
import { getCircleContentStatsForIds } from "@/lib/utils/circles/get-circle-content-stats";
import type { UpdateCircleInput } from "@/types/circles";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]
 * Get a single circle. Auth required; owner or member can view.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: circle, error } = await supabase
      .from("circles")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
    const lifecycle = (circle as { status?: string }).status;
    if (lifecycle === "deleted" && (circle as { expert_id: string }).expert_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if ((circle as { expert_id: string }).expert_id !== user.id) {
      const { data: member } = await supabase
        .from("circle_memberships")
        .select("id")
        .eq("circle_id", id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();
      if (!member) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const canInvite = await canInviteMembers(id, user.id);
    const statsMap = await getCircleContentStatsForIds(supabase, [id]);
    const content_stats = statsMap[id] ?? {
      post_count: 0,
      total_view_count: 0,
      total_like_count: 0,
    };
    const is_owner = (circle as { expert_id: string }).expert_id === user.id;
    return NextResponse.json({ circle, can_invite: canInvite, content_stats, is_owner });
  } catch (err) {
    console.error("GET /api/circles/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/circles/[id]
 * Update a circle. Auth required; only owner can update. Public circles require category_id.
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

    const { data: existing } = await supabase
      .from("circles")
      .select("id, expert_id, visibility, category_id, status")
      .eq("id", id)
      .single();
    if (!existing) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }
    if ((existing as { expert_id: string }).expert_id !== user.id) {
      return NextResponse.json({ error: "Only the circle owner can update it" }, { status: 403 });
    }
    if ((existing as { status?: string }).status === "deleted") {
      return NextResponse.json(
        { error: "Deleted circles cannot be updated. Contact support if you need help." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpdateCircleInput;
    const {
      name,
      description,
      cover_image_url,
      visibility,
      category_id,
      is_active,
      is_featured,
      access_type,
      price_cents,
      settings,
    } = body;
    if (is_active !== undefined) {
      return NextResponse.json(
        {
          error:
            "Use /api/circles/[id]/archive or /api/circles/[id]/unarchive for lifecycle changes.",
        },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() ?? null;
    if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url?.trim() || null;
    if (visibility !== undefined) updates.visibility = visibility;
    if (category_id !== undefined) updates.category_id = category_id || null;
    if (is_featured !== undefined) updates.is_featured = is_featured;
    if (access_type !== undefined) updates.access_type = access_type;
    if (price_cents !== undefined) updates.price_cents = access_type === "paid" ? price_cents : null;
    if (settings !== undefined) updates.settings = settings;

    const effectiveVisibility = (visibility ?? (existing as { visibility: string }).visibility) as string;
    if (effectiveVisibility === "public") {
      const effectiveCategoryId = (category_id ?? (existing as { category_id: string | null }).category_id) as string | null;
      if (!effectiveCategoryId?.trim()) {
        return NextResponse.json(
          { error: "Public circles must have a category" },
          { status: 400 }
        );
      }
      const { data: cat } = await supabase
        .from("circle_categories")
        .select("id")
        .eq("id", effectiveCategoryId)
        .eq("is_active", true)
        .single();
      if (!cat) {
        return NextResponse.json(
          { error: "Invalid or inactive category" },
          { status: 400 }
        );
      }
    }

    const { data: circle, error } = await supabase
      .from("circles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating circle:", error);
      return NextResponse.json(
        { error: "Failed to update circle" },
        { status: 500 }
      );
    }

    return NextResponse.json({ circle });
  } catch (err) {
    console.error("PATCH /api/circles/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
