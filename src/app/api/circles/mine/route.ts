import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { CircleMemberRole, CircleVisibility } from "@/types/circles";

type CircleCategoryMini = { id: string; name: string; slug: string };
type CircleExpertMini = { id: string; full_name: string; avatar_url: string | null; expertise: string | null };

type CircleMini = {
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
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
  category: CircleCategoryMini | null;
  expert: CircleExpertMini | null;
};

/**
 * GET /api/circles/mine
 * Auth required. Returns circles the user owns and circles they are an active member of (with role).
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

    const { data: ownedRows, error: ownedError } = await supabase
      .from("circles")
      .select(
        `
        id,
        expert_id,
        name,
        slug,
        description,
        cover_image_url,
        visibility,
        category_id,
        is_featured,
        access_type,
        price_cents,
        is_active,
        member_count,
        created_at,
        updated_at,
        profiles!circles_expert_id_profiles_fkey(id, full_name, avatar_url, expertise),
        circle_categories(id, name, slug)
      `
      )
      .eq("expert_id", user.id)
      .order("created_at", { ascending: false });

    if (ownedError) {
      console.error("Error fetching owned circles:", ownedError);
      return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 });
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("circle_memberships")
      .select("id, circle_id, role, joined_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("joined_at", { ascending: false });

    if (membershipError) {
      console.error("Error fetching memberships:", membershipError);
      return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 });
    }

    const owned = (ownedRows ?? []).map((r: any) => ({
      id: r.id,
      expert_id: r.expert_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      cover_image_url: r.cover_image_url,
      visibility: r.visibility as CircleVisibility,
      category_id: r.category_id,
      is_featured: !!r.is_featured,
      access_type: r.access_type,
      price_cents: r.price_cents,
      is_active: !!r.is_active,
      member_count: r.member_count ?? 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
      category: r.circle_categories
        ? { id: r.circle_categories.id, name: r.circle_categories.name, slug: r.circle_categories.slug }
        : null,
      expert: r.profiles
        ? {
            id: r.profiles.id,
            full_name: r.profiles.full_name ?? "",
            avatar_url: r.profiles.avatar_url ?? null,
            expertise: r.profiles.expertise ?? null,
          }
        : null,
    })) as CircleMini[];

    const membershipCircleIds = [...new Set((membershipRows ?? []).map((m: any) => m.circle_id))];
    const memberCircleIds = membershipCircleIds.filter((id) => !owned.some((c) => c.id === id));

    let memberCircles: CircleMini[] = [];
    if (memberCircleIds.length > 0) {
      const { data: memberCircleRows, error: circlesError } = await supabase
        .from("circles")
        .select(
          `
          id,
          expert_id,
          name,
          slug,
          description,
          cover_image_url,
          visibility,
          category_id,
          is_featured,
          access_type,
          price_cents,
          is_active,
          member_count,
          created_at,
          updated_at,
          profiles!circles_expert_id_profiles_fkey(id, full_name, avatar_url, expertise),
          circle_categories(id, name, slug)
        `
        )
        .in("id", memberCircleIds)
        .order("created_at", { ascending: false });

      if (circlesError) {
        console.error("Error fetching member circles:", circlesError);
        return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 });
      }

      memberCircles = (memberCircleRows ?? []).map((r: any) => ({
        id: r.id,
        expert_id: r.expert_id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        cover_image_url: r.cover_image_url,
        visibility: r.visibility as CircleVisibility,
        category_id: r.category_id,
        is_featured: !!r.is_featured,
        access_type: r.access_type,
        price_cents: r.price_cents,
        is_active: !!r.is_active,
        member_count: r.member_count ?? 0,
        created_at: r.created_at,
        updated_at: r.updated_at,
        category: r.circle_categories
          ? { id: r.circle_categories.id, name: r.circle_categories.name, slug: r.circle_categories.slug }
          : null,
        expert: r.profiles
          ? {
              id: r.profiles.id,
              full_name: r.profiles.full_name ?? "",
              avatar_url: r.profiles.avatar_url ?? null,
              expertise: r.profiles.expertise ?? null,
            }
          : null,
      })) as CircleMini[];
    }

    const membershipMap = new Map(
      (membershipRows ?? []).map((m: any) => [
        m.circle_id as string,
        { membership_id: m.id as string, role: m.role as CircleMemberRole, joined_at: m.joined_at as string },
      ])
    );

    const member_of = memberCircles
      .map((c) => ({
        circle: c,
        membership: membershipMap.get(c.id)!,
      }))
      .filter((x) => !!x.membership);

    return NextResponse.json({ owned, member_of });
  } catch (err) {
    console.error("GET /api/circles/mine:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

