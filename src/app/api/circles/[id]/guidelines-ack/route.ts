import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle } from "@/lib/utils/circles/access-control";
import { jsonCircleAccessForbidden } from "@/lib/utils/circles/access-denied-response";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/circles/[id]/guidelines-ack
 * Returns whether current user acknowledged latest welcome guidelines.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await canAccessCircle(circleId, user.id);
    if (!allowed) return jsonCircleAccessForbidden(circleId, user.id);

    const { data: circle } = await supabase
      .from("circles")
      .select("settings")
      .eq("id", circleId)
      .single();
    const required =
      (circle as { settings?: { require_guidelines_ack?: boolean } } | null)?.settings
        ?.require_guidelines_ack === true;

    const { data: welcome } = await supabase
      .from("circle_content")
      .select("welcome_version")
      .eq("circle_id", circleId)
      .eq("is_welcome_post", true)
      .eq("approval_status", "approved")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const requiredVersion = Number((welcome as { welcome_version?: number } | null)?.welcome_version ?? 0);

    const { data: ack } = await supabase
      .from("circle_guideline_acknowledgments")
      .select("welcome_version, acknowledged_at")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle();
    const ackVersion = Number((ack as { welcome_version?: number } | null)?.welcome_version ?? 0);

    return NextResponse.json({
      required: required && requiredVersion > 0,
      required_version: requiredVersion,
      acknowledged: !required || requiredVersion === 0 || ackVersion >= requiredVersion,
      acknowledged_version: ackVersion,
      acknowledged_at: (ack as { acknowledged_at?: string } | null)?.acknowledged_at ?? null,
    });
  } catch (err) {
    console.error("GET /api/circles/[id]/guidelines-ack:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/circles/[id]/guidelines-ack
 * Upserts current user's guideline acknowledgment to latest welcome version.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await canAccessCircle(circleId, user.id);
    if (!allowed) return jsonCircleAccessForbidden(circleId, user.id);

    const { data: welcome } = await supabase
      .from("circle_content")
      .select("welcome_version")
      .eq("circle_id", circleId)
      .eq("is_welcome_post", true)
      .eq("approval_status", "approved")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const requiredVersion = Number((welcome as { welcome_version?: number } | null)?.welcome_version ?? 0);
    if (requiredVersion === 0) {
      return NextResponse.json({ acknowledged: true, acknowledged_version: 0, acknowledged_at: null });
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("circle_guideline_acknowledgments")
      .upsert(
        {
          circle_id: circleId,
          user_id: user.id,
          welcome_version: requiredVersion,
          acknowledged_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "circle_id,user_id" }
      )
      .select("welcome_version, acknowledged_at")
      .single();
    if (error) {
      console.error("Error upserting guidelines ack:", error);
      return NextResponse.json({ error: "Failed to save acknowledgment" }, { status: 500 });
    }

    return NextResponse.json({
      acknowledged: true,
      acknowledged_version: (data as { welcome_version: number }).welcome_version,
      acknowledged_at: (data as { acknowledged_at: string }).acknowledged_at,
    });
  } catch (err) {
    console.error("POST /api/circles/[id]/guidelines-ack:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
