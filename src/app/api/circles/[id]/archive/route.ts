import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { insertCircleLifecycleAudit } from "@/lib/utils/circles/circle-lifecycle-audit";
import { notifyCircleLifecycleChange } from "@/lib/utils/circles/lifecycle-notify";
import { checkLifecycleRateLimit } from "@/lib/utils/circles/lifecycle-rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/circles/[id]/archive
 * Owner-only. Body: { "confirm": true }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rateLimit = checkLifecycleRateLimit(user.id, circleId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many lifecycle actions. Try again later.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: rateLimit.retryAfterSeconds
            ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
            : undefined,
        }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Set "confirm": true to archive this circle' }, { status: 400 });
    }

    const { data: circle, error: fetchErr } = await supabase
      .from("circles")
      .select("id, expert_id, name, status")
      .eq("id", circleId)
      .single();

    if (fetchErr || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    if ((circle as { expert_id: string }).expert_id !== user.id) {
      return NextResponse.json({ error: "Only the circle owner can archive it" }, { status: 403 });
    }

    const status = (circle as { status: string }).status;
    if (status !== "active") {
      return NextResponse.json(
        { error: "Only active circles can be archived" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await supabase
      .from("circles")
      .update({
        status: "archived",
        archived_at: now,
        archived_by: user.id,
      })
      .eq("id", circleId)
      .eq("expert_id", user.id)
      .select()
      .single();

    if (updErr) {
      console.error("archive circle:", updErr);
      return NextResponse.json({ error: "Failed to archive circle" }, { status: 500 });
    }

    await insertCircleLifecycleAudit(supabase, circleId, user.id, "circle_archived", {
      previous_status: "active",
    });
    notifyCircleLifecycleChange({
      circleId,
      action: "archived",
      actorUserId: user.id,
      circleName: (circle as { name: string }).name,
    });

    return NextResponse.json({ circle: updated });
  } catch (err) {
    console.error("POST /api/circles/[id]/archive:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
