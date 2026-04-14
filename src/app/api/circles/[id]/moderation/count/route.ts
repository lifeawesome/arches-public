import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canModerateContent } from "@/lib/utils/circles/access-control";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/moderation/count
 * Returns the number of pending items awaiting moderation.
 * Only moderators/owners can call this.
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

    const canModerate = await canModerateContent(circleId, user.id);
    if (!canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { count, error } = await supabase
      .from("circle_content")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .eq("approval_status", "pending")
      .eq("publication_status", "published");

    if (error) {
      console.error("Error fetching moderation count:", error);
      return NextResponse.json({ error: "Failed to fetch count" }, { status: 500 });
    }

    return NextResponse.json({ pending_count: count ?? 0 });
  } catch (err) {
    console.error("GET /api/circles/[id]/moderation/count:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
