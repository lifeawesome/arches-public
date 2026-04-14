import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { insertCircleLifecycleAudit } from "@/lib/utils/circles/circle-lifecycle-audit";
import { notifyCircleLifecycleChange } from "@/lib/utils/circles/lifecycle-notify";
import { checkLifecycleRateLimit } from "@/lib/utils/circles/lifecycle-rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/circles/[id]/delete
 * Owner-only soft-delete. Body: { "confirm": true, "confirm_circle_name": "<exact name>" }
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

    const body = (await request.json().catch(() => ({}))) as {
      confirm?: boolean;
      confirm_circle_name?: string;
    };
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Set "confirm": true to delete this circle' }, { status: 400 });
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
      return NextResponse.json({ error: "Only the circle owner can delete it" }, { status: 403 });
    }

    const cname = (circle as { name: string }).name.trim();
    const confirmName = typeof body.confirm_circle_name === "string" ? body.confirm_circle_name.trim() : "";
    if (confirmName !== cname) {
      return NextResponse.json(
        { error: "Type the circle name exactly to confirm deletion" },
        { status: 400 }
      );
    }

    const status = (circle as { status: string }).status;
    if (status === "deleted") {
      return NextResponse.json({ error: "Circle is already deleted" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await supabase
      .from("circles")
      .update({
        status: "deleted",
        deleted_at: now,
        deleted_by: user.id,
        archived_at: null,
        archived_by: null,
      })
      .eq("id", circleId)
      .eq("expert_id", user.id)
      .select()
      .single();

    if (updErr) {
      console.error("soft-delete circle:", updErr);
      return NextResponse.json({ error: "Failed to delete circle" }, { status: 500 });
    }

    await insertCircleLifecycleAudit(supabase, circleId, user.id, "circle_deleted", {
      previous_status: status,
    });
    notifyCircleLifecycleChange({
      circleId,
      action: "deleted",
      actorUserId: user.id,
      circleName: cname,
    });

    return NextResponse.json({ circle: updated });
  } catch (err) {
    console.error("POST /api/circles/[id]/delete:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
