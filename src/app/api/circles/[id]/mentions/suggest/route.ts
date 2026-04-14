import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserRoleInCircle } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/mentions/suggest?q=...
 * Members who can @mention: active members + owner (for autocomplete).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = await getUserRoleInCircle(circleId, user.id);
    if (!role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20, 50);

    const { data: circle, error: cErr } = await supabase
      .from("circles")
      .select("expert_id")
      .eq("id", circleId)
      .single();

    if (cErr || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const expertId = (circle as { expert_id: string }).expert_id;

    const { data: memberships, error: mErr } = await supabase
      .from("circle_memberships")
      .select("user_id")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .not("user_id", "is", null);

    if (mErr) {
      console.error("mentions suggest memberships:", mErr);
      return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
    }

    const memberIds = [
      expertId,
      ...new Set(
        (memberships ?? [])
          .map((m) => (m as { user_id: string | null }).user_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    if (memberIds.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", memberIds)
      .not("username", "is", null);

    if (pErr) {
      console.error("mentions suggest profiles:", pErr);
      return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
    }

    let rows = (profiles ?? []) as {
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }[];

    if (q.length > 0) {
      rows = rows.filter((p) => {
        const u = (p.username ?? "").toLowerCase();
        const n = (p.full_name ?? "").toLowerCase();
        return u.includes(q) || n.includes(q);
      });
    }

    rows.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
    rows = rows.slice(0, limit);

    const suggestions = rows.map((p) => ({
      user_id: p.id,
      username: p.username,
      full_name: p.full_name ?? "",
      avatar_url: p.avatar_url ?? null,
    }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("GET /api/circles/[id]/mentions/suggest:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
