"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, BarChart3, Download, Loader2, RefreshCw } from "lucide-react";
import type { Circle } from "@/types/circles";
import type { CircleAnalyticsResponse } from "@/types/circles";
import { formatCompactNumber, formatExactCount } from "@/lib/utils/format-compact-number";

const POLL_MS = 30_000;

function StatFigure({ value }: { value: number }) {
  return (
    <span title={formatExactCount(value)} className="cursor-default tabular-nums">
      {formatCompactNumber(value)}
    </span>
  );
}

function analyticsQueryParams(dateFrom: string, dateTo: string) {
  const qs = new URLSearchParams({ include_peers: "1" });
  if (dateFrom.trim()) qs.set("from", new Date(dateFrom).toISOString());
  if (dateTo.trim()) qs.set("to", new Date(dateTo).toISOString());
  return qs;
}

export default function CircleAnalyticsPage() {
  const params = useParams();
  const id = params?.id as string;

  const [circle, setCircle] = useState<Circle | null>(null);
  const [data, setData] = useState<CircleAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!id) return;
    const qs = analyticsQueryParams(dateFrom, dateTo);
    const res = await fetch(`/api/circles/${id}/analytics?${qs}`);
    if (res.status === 403) {
      setError("Only the circle owner can view analytics.");
      setData(null);
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Failed to load analytics");
      setData(null);
      return;
    }
    const body = (await res.json()) as CircleAnalyticsResponse;
    setData(body);
    setError(null);
  }, [id, dateFrom, dateTo]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/circles/${id}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const j = await res.json();
        return j.circle as Circle | null;
      })
      .then(async (c) => {
        if (cancelled) return;
        setCircle(c);
        if (!c) {
          setError("Circle not found or you don’t have access.");
          return;
        }
        const qs = analyticsQueryParams("", "");
        const res = await fetch(`/api/circles/${id}/analytics?${qs}`);
        if (cancelled) return;
        if (res.status === 403) {
          setError("Only the circle owner can view analytics.");
          setData(null);
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError((j as { error?: string }).error ?? "Failed to load analytics");
          setData(null);
          return;
        }
        const body = (await res.json()) as CircleAnalyticsResponse;
        setData(body);
        setError(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !circle) return;
    const t = setInterval(() => {
      void loadAnalytics();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [id, circle, loadAnalytics]);

  const applyWindow = () => {
    setLoading(true);
    void loadAnalytics().finally(() => setLoading(false));
  };

  const handleExport = async () => {
    if (!id || exporting) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams({ format: "csv" });
      if (dateFrom.trim()) qs.set("from", new Date(dateFrom).toISOString());
      if (dateTo.trim()) qs.set("to", new Date(dateTo).toISOString());
      const res = await fetch(`/api/circles/${id}/analytics/export?${qs}`);
      if (!res.ok) {
        setError("Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `circle-analytics-${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (!circle && !loading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl p-4">
          <p className="text-destructive">{error ?? "Circle not found."}</p>
          <Button variant="link" asChild>
            <Link href="/dashboard/circles">Back to My Circles</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-4">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/circles/${id}/edit`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="h-6 w-6 shrink-0" />
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              {circle?.name ?? "…"} — views, upvotes, and comments for posts and polls
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadAnalytics()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => void handleExport()} disabled={exporting || !data}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Time window</CardTitle>
            <CardDescription>
              Filter totals and top content by <code className="text-xs">published_at</code> (optional). Data
              refreshes every {POLL_MS / 1000}s while this page is open.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={applyWindow} disabled={loading}>
              Apply
            </Button>
          </CardContent>
        </Card>

        {loading && !data && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {data && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Members</CardDescription>
                  <CardTitle className="text-2xl">
                    <StatFigure value={data.analytics.member_count} />
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total views</CardDescription>
                  <CardTitle className="text-2xl">
                    <StatFigure value={data.analytics.totals.view_count} />
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Upvotes (likes)</CardDescription>
                  <CardTitle className="text-2xl">
                    <StatFigure value={data.analytics.totals.like_count} />
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Comments</CardDescription>
                  <CardTitle className="text-2xl">
                    <StatFigure value={data.analytics.totals.comment_count} />
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Content in window</CardTitle>
                <CardDescription>
                  Approved posts & polls matching the filter: {data.analytics.content_items_count} items
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Approved</span>
                  <p className="text-lg font-semibold">{data.analytics.by_approval.approved}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pending</span>
                  <p className="text-lg font-semibold">{data.analytics.by_approval.pending}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rejected</span>
                  <p className="text-lg font-semibold">{data.analytics.by_approval.rejected}</p>
                </div>
              </CardContent>
            </Card>

            {data.peer_circles && data.peer_circles.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">Your other circles</CardTitle>
                  <CardDescription>Comparison using the same time window (totals over approved feed content).</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Circle</TableHead>
                        <TableHead className="text-right">Members</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Upvotes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.peer_circles.map((p) => (
                        <TableRow key={p.circle_id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/circles/${p.circle_id}/analytics`}
                              className="font-medium text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={p.member_count} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={p.totals.view_count} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={p.totals.like_count} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={p.totals.comment_count} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top content by views</CardTitle>
                <CardDescription>Up to 20 approved items in the selected window.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Upvotes</TableHead>
                      <TableHead className="text-right">Comments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.analytics.top_by_views.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No content in this window yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.analytics.top_by_views.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="max-w-[240px] truncate font-medium">{row.title}</TableCell>
                          <TableCell>{row.content_type}</TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={row.view_count} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={row.like_count} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatFigure value={row.comment_count} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <p className="mt-4 text-xs text-muted-foreground">
              Last updated: {new Date(data.analytics.generated_at).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
