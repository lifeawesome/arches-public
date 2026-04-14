import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle, canShareToCircle } from "@/lib/utils/circles/access-control";
import type { CircleVisibility } from "@/types/circles";

type TargetRow = {
  id: string;
  name: string;
  slug: string;
  visibility: CircleVisibility;
};

/**
 * GET /api/circles/share-targets
 * Circles the current user can access and share into (who_can_share / posting rules).
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
      .select("id, name, slug, visibility")
      .eq("expert_id", user.id)
      .neq("status", "deleted");

    if (ownedError) {
      console.error("share-targets owned:", ownedError);
      return NextResponse.json({ error: "Failed to load circles" }, { status: 500 });
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("circle_memberships")
      .select("circle_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipError) {
      console.error("share-targets memberships:", membershipError);
      return NextResponse.json({ error: "Failed to load circles" }, { status: 500 });
    }

    const memberCircleIds = [...new Set((membershipRows ?? []).map((m) => m.circle_id as string))];
    let memberCircles: TargetRow[] = [];
    if (memberCircleIds.length > 0) {
      const { data: mc, error: mcError } = await supabase
        .from("circles")
        .select("id, name, slug, visibility")
        .in("id", memberCircleIds)
        .neq("status", "deleted");
      if (mcError) {
        console.error("share-targets member circles:", mcError);
        return NextResponse.json({ error: "Failed to load circles" }, { status: 500 });
      }
      memberCircles = (mc ?? []) as TargetRow[];
    }

    const byId = new Map<string, TargetRow>();
    for (const r of (ownedRows ?? []) as TargetRow[]) byId.set(r.id, r);
    for (const r of memberCircles) byId.set(r.id, r);

    const targets: TargetRow[] = [];
    for (const row of byId.values()) {
      const canAccess = await canAccessCircle(row.id, user.id);
      if (!canAccess) continue;
      const canShare = await canShareToCircle(row.id, user.id);
      if (!canShare) continue;
      targets.push(row);
    }

    targets.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ targets });
  } catch (err) {
    console.error("GET /api/circles/share-targets:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
