import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/platform-reports/[id]
 * Mark report reviewed or dismissed. Administrator only.
 * Body: { status: 'reviewed' | 'dismissed' }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: reportId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getAppRBACProfile(supabase, user.id);
    if (!profile || !hasAppAccessLevel(profile.app_access_level, "administrator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { status?: string };
    const status = body?.status;
    if (status !== "reviewed" && status !== "dismissed") {
      return NextResponse.json(
        { error: "Body must include status: 'reviewed' or 'dismissed'" },
        { status: 400 }
      );
    }

    const { data: report, error: fetchError } = await supabase
      .from("platform_reports")
      .select("id, status, reporter_id")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if ((report as { status: string }).status !== "pending") {
      return NextResponse.json(
        { error: "Report is already closed" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("platform_reports")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", reportId)
      .select()
      .single();

    if (updateError) {
      return upstreamError(
        "PATCH /api/admin/platform-reports/[id] update",
        "Failed to update report",
        updateError
      );
    }

    const reporterId = (report as { reporter_id: string }).reporter_id;
    if (reporterId && reporterId !== user.id) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (serviceKey && supabaseUrl) {
        const adminDb = createAdminClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const title =
          status === "reviewed"
            ? "Your circle report was reviewed"
            : "Your circle report was dismissed";
        const message =
          status === "reviewed"
            ? "Platform staff reviewed your report about a circle."
            : "Platform staff reviewed your report about a circle and dismissed it.";
        const { error: notifyErr } = await adminDb.rpc("create_notification_event", {
          p_user_id: reporterId,
          p_event_type: "moderation_report_reviewed",
          p_title: title,
          p_message: message,
          p_metadata: {
            platform_report_id: reportId,
            outcome: status,
            notification_key: `platform_report_${reportId}_${status}`,
          },
          p_action_url: `/circles`,
          p_priority: "normal",
          p_channels: ["in_app"],
        });
        if (notifyErr) {
          console.error("[platform report PATCH] notify:", notifyErr.message);
        }
      }
    }

    return NextResponse.json({ report: updated });
  } catch (err) {
    return internalServerError("PATCH /api/admin/platform-reports/[id]:", err);
  }
}
