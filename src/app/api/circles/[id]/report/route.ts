import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { canAccessCircle, isBlockedFromCircle } from "@/lib/utils/circles/access-control";
import {
  isReportReason,
  parseReportDescription,
  type ReportReason,
} from "@/lib/reports/report-reasons";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/circles/[id]/report
 * Submit a report for content or comment. Caller must have access to the circle and not be blocked.
 * Body: { reported_content_id?, reported_comment_id?, reason?, description?, reason_text? (legacy) }
 * At least one of reported_content_id or reported_comment_id is required.
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

    if (await isBlockedFromCircle(circleId, user.id)) {
      return NextResponse.json(
        { error: "You cannot report content in this circle" },
        { status: 403 }
      );
    }

    const hasAccess = await canAccessCircle(circleId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this circle" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      reported_content_id?: string;
      reported_comment_id?: string;
      reason?: string;
      description?: string;
      reason_text?: string;
    };
    const { reported_content_id, reported_comment_id, reason_text } = body;

    let reason: ReportReason = "other";
    if (body.reason !== undefined && body.reason !== "") {
      if (!isReportReason(body.reason)) {
        return NextResponse.json(
          { error: "Invalid reason" },
          { status: 400 }
        );
      }
      reason = body.reason;
    }

    const descParsed = parseReportDescription(body.description);
    if (!descParsed.ok) {
      return NextResponse.json({ error: descParsed.error }, { status: 400 });
    }
    const description = descParsed.value;

    if (!reported_content_id && !reported_comment_id) {
      return NextResponse.json(
        { error: "Provide reported_content_id or reported_comment_id" },
        { status: 400 }
      );
    }

    if (reported_content_id) {
      const { data: content } = await supabase
        .from("circle_content")
        .select("id, circle_id")
        .eq("id", reported_content_id)
        .eq("circle_id", circleId)
        .single();
      if (!content) {
        return NextResponse.json(
          { error: "Content not found in this circle" },
          { status: 404 }
        );
      }
    }

    if (reported_comment_id) {
      const { data: comment } = await supabase
        .from("circle_comments")
        .select("id, content_id")
        .eq("id", reported_comment_id)
        .single();
      if (!comment) {
        return NextResponse.json(
          { error: "Comment not found" },
          { status: 404 }
        );
      }
      const { data: content } = await supabase
        .from("circle_content")
        .select("circle_id")
        .eq("id", (comment as { content_id: string }).content_id)
        .single();
      if (!content || (content as { circle_id: string }).circle_id !== circleId) {
        return NextResponse.json(
          { error: "Comment not found in this circle" },
          { status: 404 }
        );
      }
    }

    const legacyReasonText =
      (reason_text?.trim() || description || null) as string | null;

    const { data: inserted, error } = await supabase
      .from("circle_reports")
      .insert({
        circle_id: circleId,
        reporter_id: user.id,
        reported_content_id: reported_content_id ?? null,
        reported_comment_id: reported_comment_id ?? null,
        reason,
        description,
        reason_text: legacyReasonText,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return upstreamError(
        "POST /api/circles/[id]/report insert",
        "Failed to submit report",
        error
      );
    }

    return NextResponse.json({ report: inserted }, { status: 201 });
  } catch (err) {
    return internalServerError("POST /api/circles/[id]/report:", err);
  }
}
