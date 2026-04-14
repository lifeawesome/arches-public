import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { canViewReports } from "@/lib/utils/circles/access-control";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";

type RouteParams = { params: Promise<{ id: string; reportId: string }> };

/**
 * PATCH /api/circles/[id]/moderation/reports/[reportId]
 * Resolve or dismiss a report. Moderators/owners only.
 * Body: { status: 'resolved' | 'dismissed' }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: circleId, reportId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canResolve = await canViewReports(circleId, user.id);
    if (!canResolve) {
      return NextResponse.json(
        { error: "Only moderators and owners can resolve reports" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { status?: string };
    const status = body?.status;
    if (status !== "resolved" && status !== "dismissed") {
      return NextResponse.json(
        { error: "Body must include status: 'resolved' or 'dismissed'" },
        { status: 400 }
      );
    }

    const { data: report, error: fetchError } = await supabase
      .from("circle_reports")
      .select("id, circle_id, status, reporter_id")
      .eq("id", reportId)
      .eq("circle_id", circleId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if ((report as { status: string }).status !== "pending") {
      return NextResponse.json(
        { error: "Report is already resolved or dismissed" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("circle_reports")
      .update({
        status,
        resolved_by: user.id,
        resolved_at: now,
      })
      .eq("id", reportId)
      .eq("circle_id", circleId)
      .select()
      .single();

    if (updateError) {
      return upstreamError(
        "PATCH circle moderation report",
        "Failed to update report",
        updateError
      );
    }

    await supabase.from("circle_moderation_activity_log").insert({
      circle_id: circleId,
      actor_id: user.id,
      action: status === "resolved" ? "report_resolved" : "report_dismissed",
      target_type: "report",
      target_id: reportId,
      metadata: {},
    });

    const reporterId = (report as { reporter_id: string }).reporter_id;
    if (reporterId && reporterId !== user.id) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (serviceKey && supabaseUrl) {
        const adminDb = createAdminClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const title =
          status === "resolved"
            ? "Your report was resolved"
            : "Your report was dismissed";
        const message =
          status === "resolved"
            ? "A moderator reviewed your report about content in a circle you belong to."
            : "A moderator reviewed your report about content in a circle you belong to and dismissed it.";
        const { error: notifyErr } = await adminDb.rpc("create_notification_event", {
          p_user_id: reporterId,
          p_event_type: "moderation_report_reviewed",
          p_title: title,
          p_message: message,
          p_metadata: {
            circle_report_id: reportId,
            circle_id: circleId,
            outcome: status,
            notification_key: `circle_report_${reportId}_${status}`,
          },
          p_action_url: `/circles`,
          p_priority: "normal",
          p_channels: ["in_app"],
        });
        if (notifyErr) {
          console.error("[circle report PATCH] notify reporter:", notifyErr.message);
        }
      }
    }

    return NextResponse.json({ report: updated });
  } catch (err) {
    return internalServerError("PATCH circle moderation report:", err);
  }
}
