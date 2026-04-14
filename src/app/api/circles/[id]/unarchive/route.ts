import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { insertCircleLifecycleAudit } from "@/lib/utils/circles/circle-lifecycle-audit";
import { notifyCircleLifecycleChange } from "@/lib/utils/circles/lifecycle-notify";
import { checkLifecycleRateLimit } from "@/lib/utils/circles/lifecycle-rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/circles/[id]/unarchive
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
      return NextResponse.json({ error: 'Set "confirm": true to restore this circle' }, { status: 400 });
    }

    const { data: circle, error: fetchErr } = await supabase
      .from("circles")
      .select("id, expert_id, name, status, category_id, visibility")
      .eq("id", circleId)
      .single();

    if (fetchErr || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    if ((circle as { expert_id: string }).expert_id !== user.id) {
      return NextResponse.json({ error: "Only the circle owner can unarchive it" }, { status: 403 });
    }

    const status = (circle as { status: string }).status;
    if (status !== "archived") {
      return NextResponse.json({ error: "Circle is not archived" }, { status: 400 });
    }

    const visibility = (circle as { visibility: string }).visibility;
    const categoryId = (circle as { category_id: string | null }).category_id;
    if (visibility === "public" && !categoryId?.trim()) {
      return NextResponse.json(
        {
          error:
            "Public circles must have a category before they can return to the directory. Set a category in settings first.",
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from("circles")
      .update({
        status: "active",
        archived_at: null,
        archived_by: null,
      })
      .eq("id", circleId)
      .eq("expert_id", user.id)
      .select()
      .single();

    if (updErr) {
      console.error("unarchive circle:", updErr);
      return NextResponse.json({ error: "Failed to unarchive circle" }, { status: 500 });
    }

    await insertCircleLifecycleAudit(supabase, circleId, user.id, "circle_unarchived", {
      previous_status: "archived",
    });
    notifyCircleLifecycleChange({
      circleId,
      action: "unarchived",
      actorUserId: user.id,
      circleName: (circle as { name: string }).name,
    });

    return NextResponse.json({ circle: updated });
  } catch (err) {
    console.error("POST /api/circles/[id]/unarchive:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
