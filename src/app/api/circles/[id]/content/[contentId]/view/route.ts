import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { canAccessCircle } from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";

type RouteParams = { params: Promise<{ id: string; contentId: string }> };

/**
 * POST /api/circles/[id]/content/[contentId]/view
 * Records a view for analytics (increments view_count) when the caller can access the circle.
 * Idempotent per browser session is handled client-side (sessionStorage).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, contentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const canAccess = await canAccessCircle(circleId, user?.id ?? null);
    if (!canAccess) {
      return jsonCircleAccessForbidden(circleId, user?.id);
    }

    const admin = createServiceRoleClient();
    const { data: ok, error } = await admin.rpc("increment_circle_content_view_count", {
      p_circle_id: circleId,
      p_content_id: contentId,
    });

    if (error) {
      console.error("increment_circle_content_view_count:", error);
      return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
    }

    if (!ok) {
      return NextResponse.json({ recorded: false }, { status: 404 });
    }

    return NextResponse.json({ recorded: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Missing NEXT_PUBLIC_SUPABASE_URL")) {
      console.error("POST view: service role not configured");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
    }
    console.error("POST /api/circles/[id]/content/[contentId]/view:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
