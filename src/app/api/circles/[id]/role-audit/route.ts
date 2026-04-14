import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canManageRoles } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/role-audit
 * Owner-only. Returns the 50 most recent role change entries for the circle,
 * joined with the affected user's name and the changer's name.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = await canManageRoles(circleId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the circle owner can view the role audit log" },
        { status: 403 }
      );
    }

    const { data: entries, error } = await supabase
      .from("circle_role_audit_log")
      .select("id, circle_id, membership_id, user_id, changed_by, old_role, new_role, created_at")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching role audit log:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit log", details: error.message },
        { status: 500 }
      );
    }

    const allUserIds = [
      ...new Set([
        ...(entries ?? []).map((e) => e.user_id as string),
        ...(entries ?? []).map((e) => e.changed_by as string),
      ]),
    ];

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", allUserIds);

    const profileMap = new Map(
      (profilesData ?? []).map((p) => [p.id, p])
    );

    const enriched = (entries ?? []).map((e) => ({
      id: e.id,
      circle_id: e.circle_id,
      membership_id: e.membership_id,
      old_role: e.old_role,
      new_role: e.new_role,
      created_at: e.created_at,
      user: profileMap.get(e.user_id as string) ?? { id: e.user_id, full_name: "Unknown", avatar_url: null },
      changed_by: profileMap.get(e.changed_by as string) ?? { id: e.changed_by, full_name: "Unknown", avatar_url: null },
    }));

    return NextResponse.json({ entries: enriched, total: enriched.length });
  } catch (err) {
    console.error("GET /api/circles/[id]/role-audit:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
