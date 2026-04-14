import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAppRBACProfile, hasAppAccessLevel } from "@/lib/rbac/app-rbac";
import { internalServerError, upstreamError } from "@/lib/utils/api-public-error";

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

/**
 * GET /api/admin/platform-reports
 * List platform reports. Administrator only. Query: status, page, per_page.
 */
export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as
      | "pending"
      | "reviewed"
      | "dismissed"
      | null;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const perPageRaw =
      parseInt(searchParams.get("per_page") || String(DEFAULT_PER_PAGE), 10) ||
      DEFAULT_PER_PAGE;
    const perPage = Math.min(Math.max(perPageRaw, 1), MAX_PER_PAGE);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from("platform_reports")
      .select(
        `
        id,
        report_type,
        reported_id,
        reporter_id,
        reason,
        description,
        status,
        reviewed_by,
        reviewed_at,
        created_at
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status && ["pending", "reviewed", "dismissed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      return upstreamError(
        "GET /api/admin/platform-reports",
        "Failed to load reports",
        error
      );
    }

    const reports = rows ?? [];
    const circleIds = [
      ...new Set(
        reports
          .filter((r: { report_type: string }) => r.report_type === "circle")
          .map((r: { reported_id: string }) => r.reported_id)
      ),
    ];

    let circleNames: Record<string, string> = {};
    if (circleIds.length > 0) {
      const { data: circles } = await supabase
        .from("circles")
        .select("id, name")
        .in("id", circleIds);
      if (circles) {
        circleNames = Object.fromEntries(
          circles.map((c: { id: string; name: string }) => [c.id, c.name])
        );
      }
    }

    const enriched = reports.map(
      (r: {
        report_type: string;
        reported_id: string;
        [key: string]: unknown;
      }) => ({
        ...r,
        circle_name:
          r.report_type === "circle" ? circleNames[r.reported_id] ?? null : null,
      })
    );

    return NextResponse.json({
      reports: enriched,
      total: count ?? 0,
      page,
      per_page: perPage,
    });
  } catch (err) {
    return internalServerError("GET /api/admin/platform-reports:", err);
  }
}
