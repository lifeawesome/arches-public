"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, Clock, XCircle, Flag, Ban, Activity, Layers, Loader2 } from "lucide-react";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports/report-reasons";

interface PendingItem {
  id: string;
  circle_id: string;
  author_id: string;
  title: string;
  content: string;
  content_type: string;
  approval_status: string;
  created_at: string;
}

interface RejectModalState {
  contentId: string;
  title: string;
  reason: string;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_content_id: string | null;
  reported_comment_id: string | null;
  reason: ReportReason;
  description: string | null;
  reason_text: string | null;
  status: string;
  created_at: string;
}

interface BlockedRow {
  id: string;
  user_id: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
}

export default function ModerationQueuePage() {
  const params = useParams();
  const circleId = params?.id as string;

  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<RejectModalState | null>(null);
  const [total, setTotal] = useState(0);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportActionId, setReportActionId] = useState<string | null>(null);

  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);

  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | "soft_delete">("approve");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!circleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/moderation/pending`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to load moderation queue");
      }
      const data = await res.json();
      setItems(data.content ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  const loadReports = useCallback(async () => {
    if (!circleId) return;
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/moderation/reports?status=pending`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } finally {
      setReportsLoading(false);
    }
  }, [circleId]);

  const loadBlocked = useCallback(async () => {
    if (!circleId) return;
    setBlockedLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/blocked`);
      if (res.ok) {
        const data = await res.json();
        setBlocked(data.blocked ?? []);
      }
    } finally {
      setBlockedLoading(false);
    }
  }, [circleId]);

  const loadActivity = useCallback(async () => {
    if (!circleId) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/moderation/activity?page=${activityPage}&per_page=30`);
      if (res.ok) {
        const data = await res.json();
        setActivity(data.activity ?? []);
        setActivityTotal(data.total ?? 0);
      }
    } finally {
      setActivityLoading(false);
    }
  }, [circleId, activityPage]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleApprove = async (contentId: string) => {
    if (!circleId || actionId) return;
    setActionId(contentId);
    try {
      const res = await fetch(
        `/api/circles/${circleId}/content/${contentId}/approve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to approve post");
      }
      setItems((prev) => prev.filter((item) => item.id !== contentId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!circleId || !rejectModal || actionId) return;
    const { contentId, reason } = rejectModal;
    setActionId(contentId);
    try {
      const res = await fetch(
        `/api/circles/${circleId}/content/${contentId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejection_reason: reason }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to reject post");
      }
      setItems((prev) => prev.filter((item) => item.id !== contentId));
      setTotal((prev) => Math.max(0, prev - 1));
      setRejectModal(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleReportResolve = async (reportId: string, status: "resolved" | "dismissed") => {
    if (!circleId || reportActionId) return;
    setReportActionId(reportId);
    try {
      const res = await fetch(`/api/circles/${circleId}/moderation/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setReports((prev) => prev.filter((r) => r.id !== reportId));
    } finally {
      setReportActionId(null);
    }
  };

  const handleUnblock = async (userId: string) => {
    if (!circleId || unblockingId) return;
    setUnblockingId(userId);
    try {
      const res = await fetch(`/api/circles/${circleId}/blocked/${userId}`, { method: "DELETE" });
      if (res.ok) setBlocked((prev) => prev.filter((b) => b.user_id !== userId));
    } finally {
      setUnblockingId(null);
    }
  };

  const handleBulkSubmit = async () => {
    if (!circleId || bulkSelected.size === 0 || bulkSubmitting) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/moderation/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          content_ids: Array.from(bulkSelected),
        }),
      });
      if (res.ok) {
        setBulkSelected(new Set());
        void loadQueue();
      }
    } finally {
      setBulkSubmitting(false);
    }
  };

  const toggleBulkSelect = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/circles/${circleId}/edit`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Moderation</h1>
            <p className="text-sm text-muted-foreground">
              Pending posts, reports, blocked users, activity log, and bulk actions.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {total > 0 && (
              <Badge variant="secondary">
                {total} pending
              </Badge>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/circles/${circleId}/analytics`}>Analytics</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="pending" className="gap-1">
              <Clock className="h-3.5 w-3.5" />
              Pending
              {total > 0 && (
                <Badge variant="secondary" className="ml-1 size-5 rounded-full p-0 text-xs">
                  {total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1" onClick={() => void loadReports()}>
              <Flag className="h-3.5 w-3.5" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-1" onClick={() => void loadBlocked()}>
              <Ban className="h-3.5 w-3.5" />
              Blocked
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1" onClick={() => void loadActivity()}>
              <Activity className="h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1" onClick={() => void loadQueue()}>
              <Layers className="h-3.5 w-3.5" />
              Bulk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading pending posts…
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                  <p className="font-medium text-foreground">Queue is clear</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No posts are waiting for review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{item.title}</CardTitle>
                          <CardDescription className="flex items-center gap-1.5 mt-1">
                            <Clock className="h-3 w-3" />
                            Submitted {new Date(item.created_at).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-300">
                          Pending
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="whitespace-pre-wrap text-sm text-foreground line-clamp-6">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-2 border-t border-border pt-3">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item.id)}
                          disabled={actionId === item.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRejectModal({ contentId: item.id, title: item.title, reason: "" })
                          }
                          disabled={actionId === item.id}
                          className="border-destructive text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            {reportsLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading reports…</div>
            ) : reports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No pending reports.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="pt-4">
                      <p className="text-sm">
                        {r.reported_content_id ? "Content" : "Comment"} reported —{" "}
                        {REPORT_REASON_LABELS[r.reason] ?? r.reason}
                      </p>
                      {r.description && (
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                          {r.description}
                        </p>
                      )}
                      {!r.description && r.reason_text && (
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                          {r.reason_text}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reportActionId === r.id}
                          onClick={() => handleReportResolve(r.id, "resolved")}
                        >
                          {reportActionId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={reportActionId === r.id}
                          onClick={() => handleReportResolve(r.id, "dismissed")}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="blocked" className="space-y-4">
            {blockedLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading blocked users…</div>
            ) : blocked.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No blocked users. Block from the Members page.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Blocked users</CardTitle>
                  <CardDescription>Unblock to allow them to rejoin the circle.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {blocked.map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{b.user_id.slice(0, 8)}…</span>
                        <span className="text-xs text-muted-foreground">{formatDate(b.created_at)}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unblockingId === b.user_id}
                          onClick={() => handleUnblock(b.user_id)}
                        >
                          {unblockingId === b.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unblock"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            {activityLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading activity…</div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Activity log</CardTitle>
                  <CardDescription>Recent moderation actions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {activity.map((a) => (
                        <li key={a.id} className="flex justify-between gap-2 border-b border-border py-2 last:border-0">
                          <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">{formatDate(a.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {activityTotal > 30 && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activityPage <= 1}
                        onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activityPage * 30 >= activityTotal}
                        onClick={() => setActivityPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bulk actions</CardTitle>
                <CardDescription>
                  Select pending posts below, choose an action, and apply to all selected.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value as "approve" | "reject" | "soft_delete")}
                  >
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                    <option value="soft_delete">Soft delete</option>
                  </select>
                  <Button
                    disabled={bulkSelected.size === 0 || bulkSubmitting}
                    onClick={handleBulkSubmit}
                  >
                    {bulkSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Apply to {bulkSelected.size} selected
                  </Button>
                </div>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading pending…</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending posts to select.</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(item.id)}
                          onChange={() => toggleBulkSelect(item.id)}
                          className="rounded border-input"
                        />
                        <span className="text-sm">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {rejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground">Reject post</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Optionally provide a reason that will be sent to the author.
              </p>
              <p className="mt-3 text-sm font-medium text-foreground truncate">
                &ldquo;{rejectModal.title}&rdquo;
              </p>
              <textarea
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                placeholder="Reason (optional)…"
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal((prev) => prev && { ...prev, reason: e.target.value })
                }
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRejectModal(null)}
                  disabled={!!actionId}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectConfirm}
                  disabled={!!actionId}
                >
                  {actionId ? "Rejecting…" : "Reject post"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
