import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle, isBlockedFromCircle } from "@/lib/utils/circles/access-control";
import {
  isReportReason,
  parseReportDescription,
  type ReportReason,
} from "@/lib/reports/report-reasons";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";

/**
 * POST /api/platform/reports
 * Submit a platform-level report. v1: report_type must be "circle"; reported_id = circles.id.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      report_type?: string;
      reported_id?: string;
      reason?: string;
      description?: string;
    };

    if (body.report_type !== "circle") {
      return NextResponse.json(
        { error: "Only report_type 'circle' is supported" },
        { status: 400 }
      );
    }

    const reportedId = body.reported_id?.trim();
    if (!reportedId) {
      return NextResponse.json({ error: "reported_id is required" }, { status: 400 });
    }

    if (!body.reason || !isReportReason(body.reason)) {
      return NextResponse.json({ error: "Valid reason is required" }, { status: 400 });
    }
    const reason = body.reason as ReportReason;

    const descParsed = parseReportDescription(body.description);
    if (!descParsed.ok) {
      return NextResponse.json({ error: descParsed.error }, { status: 400 });
    }
    const description = descParsed.value;

    if (await isBlockedFromCircle(reportedId, user.id)) {
      return NextResponse.json(
        { error: "You cannot report this circle" },
        { status: 403 }
      );
    }

    const hasAccess = await canAccessCircle(reportedId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this circle" },
        { status: 403 }
      );
    }

    const { data: circle, error: circleErr } = await supabase
      .from("circles")
      .select("id")
      .eq("id", reportedId)
      .single();

    if (circleErr || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const { data: inserted, error } = await supabase
      .from("platform_reports")
      .insert({
        report_type: "circle",
        reported_id: reportedId,
        reporter_id: user.id,
        reason,
        description,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return upstreamError(
        "POST /api/platform/reports insert",
        "Failed to submit report",
        error
      );
    }

    return NextResponse.json({ report: inserted }, { status: 201 });
  } catch (err) {
    return internalServerError("POST /api/platform/reports:", err);
  }
}
