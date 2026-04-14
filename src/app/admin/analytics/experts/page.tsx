"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  RefreshCw,
  Users,
  MessageSquare,
  Star,
  Clock,
} from "lucide-react";
import { ExpertAnalyticsData } from "@/app/api/admin/experts/analytics/route";
import { SkillsTagCloud } from "@/components/admin/experts/SkillsTagCloud";
import { RecentWorkRequests } from "@/components/admin/experts/RecentWorkRequests";
import { TopExpertsList } from "@/components/admin/experts/TopExpertsList";
import { ExpertiseDistribution } from "@/components/admin/experts/ExpertiseDistribution";

export default function AdminExpertsPage() {
  const [data, setData] = useState<ExpertAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/experts/analytics");

      if (!response.ok) {
        throw new Error("Failed to fetch expert analytics");
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load expert analytics";
      console.error("Error fetching expert analytics:", err);
      setError(errorMessage);
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
            Expert Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Skills, expertise, and work requests overview
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            {/* Total Experts */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Total Experts
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.overview.totalExperts}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {data.overview.activeExperts} active
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Active Work Requests */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Work Requests
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.overview.totalWorkRequests}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {data.overview.pendingRequests} pending
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Verified Experts */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <Star className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Verified Experts
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.overview.verifiedExperts}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {data.overview.totalExperts > 0
                      ? (
                        (data.overview.verifiedExperts /
                          data.overview.totalExperts) *
                        100
                      ).toFixed(1)
                      : 0}
                    % verified
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Average Response Time */}
            <Card className="hover:shadow-lg transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-orange-100">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Total Skills
                  </p>
                  <p className="text-3xl font-montserratBold text-gray-900">
                    {data.skillsTagCloud.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Unique skill tags
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Skills Tag Cloud - Full Width */}
          <SkillsTagCloud data={data.skillsTagCloud} />

          {/* Expertise Distribution */}
          <ExpertiseDistribution data={data.expertiseDistribution} />

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Experts */}
            <TopExpertsList data={data.topExperts} />

            {/* Recent Work Requests */}
            <RecentWorkRequests data={data.recentWorkRequests} />
          </div>
        </>
      )}
    </div>
  );
}
