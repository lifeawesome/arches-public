"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  CreditCard,
  Activity,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AnalyticsData } from "@/app/api/admin/analytics/route";
import { MemberGrowthChart } from "@/components/admin/analytics/MemberGrowthChart";
import { SubscriptionBreakdown } from "@/components/admin/analytics/SubscriptionBreakdown";
import { TopExperts } from "@/components/admin/analytics/TopExperts";
import { MessagingActivity } from "@/components/admin/analytics/MessagingActivity";
import { RecentActivity } from "@/components/admin/analytics/RecentActivity";

const TIMEFRAMES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("30d");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/analytics?timeframe=${timeframe}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-montserratBold text-gray-900">
            Platform Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Platform insights and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant={timeframe === tf.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeframe(tf.value)}
                className={
                  timeframe === tf.value
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "hover:bg-gray-200"
                }
              >
                {tf.label}
              </Button>
            ))}
          </div>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Members */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Total Members
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.overview.totalMembers}
                  </p>
                  <div className="flex items-center gap-1 text-sm mt-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-green-600 font-medium">
                      +{data.overview.growthRate}%
                    </span>
                    <span className="text-gray-500">growth</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Subscriptions */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <CreditCard className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Active Subscriptions
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.overview.activeSubscriptions}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {data.overview.totalMembers > 0
                      ? (
                          (data.overview.activeSubscriptions /
                            data.overview.totalMembers) *
                          100
                        ).toFixed(1)
                      : 0}
                    % conversion rate
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Active Users */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <Activity className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Conversations
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.messagingActivity.reduce(
                      (sum, d) => sum + d.conversations,
                      0
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Total in period</p>
                </div>
              </CardContent>
            </Card>

            {/* Growth Rate */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-orange-100">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Growth Rate
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.overview.growthRate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    vs previous period
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member Growth Chart - Full Width */}
          <MemberGrowthChart data={data.memberGrowth} />

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Subscription Breakdown */}
            <SubscriptionBreakdown data={data.subscriptionBreakdown} />

            {/* Messaging Activity */}
            <MessagingActivity data={data.messagingActivity} />
          </div>

          {/* Top Experts and Recent Activity */}
          <div className="grid gap-6 lg:grid-cols-2">
            <TopExperts data={data.topExperts} />
            <RecentActivity data={data.recentActivity} />
          </div>

          {/* Content Performance Placeholder */}
          <Card className="border-dashed border-2">
            <CardContent className="p-8 text-center text-gray-500">
              <p className="font-medium mb-2">
                Content Performance Coming Soon
              </p>
              <p className="text-sm">
                Blog posts, courses, and events analytics will appear here once
                tracking is implemented
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
