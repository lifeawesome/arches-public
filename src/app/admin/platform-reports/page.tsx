"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Flag, Loader2 } from "lucide-react";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports/report-reasons";

interface AdminPlatformReportRow {
  id: string;
  report_type: string;
  reported_id: string;
  reporter_id: string;
  reason: ReportReason;
  description: string | null;
  status: string;
  created_at: string;
  circle_name: string | null;
}

export default function AdminPlatformReportsPage() {
  const [reports, setReports] = useState<AdminPlatformReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform-reports?status=pending");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to load");
      }
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatus = async (id: string, status: "reviewed" | "dismissed") => {
    if (actionId) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/platform-reports/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Flag className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Platform reports</h1>
            <p className="text-muted-foreground mt-1">
              Circle-level reports from members (not individual posts in the circle moderation queue).
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
            <CardDescription>Review and close reports submitted to platform staff.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No pending reports.</p>
            ) : (
              <ul className="space-y-4">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border p-4 space-y-2"
                  >
                    <p className="font-medium text-foreground">
                      Circle: {r.circle_name ?? r.reported_id.slice(0, 8) + "…"}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Reason:</span>{" "}
                      {REPORT_REASON_LABELS[r.reason] ?? r.reason}
                    </p>
                    {r.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === r.id}
                        onClick={() => handleStatus(r.id, "reviewed")}
                      >
                        {actionId === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Mark reviewed"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionId === r.id}
                        onClick={() => handleStatus(r.id, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
