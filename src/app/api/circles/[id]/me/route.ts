import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserRoleInCircle } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/me
 * Returns the current user's role in the circle. Use for role-based UI (Members, Settings, moderate actions).
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

    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single();

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const role = await getUserRoleInCircle(circleId, user.id);
    if (role === null) {
      return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
    }

    return NextResponse.json({ role });
  } catch (err) {
    console.error("GET /api/circles/[id]/me:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
