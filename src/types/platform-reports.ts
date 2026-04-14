import type { ReportReason } from "@/lib/reports/report-reasons";

export type PlatformReportType = "circle" | "post" | "comment";

export type PlatformReportStatus = "pending" | "reviewed" | "dismissed";

export interface PlatformReport {
  id: string;
  report_type: PlatformReportType;
  reported_id: string;
  reporter_id: string;
  reason: ReportReason;
  description: string | null;
  status: PlatformReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
