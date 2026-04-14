"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserWithRoleClient } from "@/utils/auth/roles.client";
import { SurveyResultsResponse } from "@/types/survey";
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
import { ArrowLeft, Download, Users, Eye, CheckCircle2 } from "lucide-react";
import { ResultsDashboard } from "@/components/admin/surveys/ResultsDashboard";
import { ResponsesTable } from "@/components/admin/surveys/ResponsesTable";

export default function SurveyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [results, setResults] = useState<SurveyResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setSurveyId(p.id);
      checkAuthAndLoad(p.id);
    });
  }, []);

  const checkAuthAndLoad = async (id: string) => {
    const userWithRole = await getCurrentUserWithRoleClient();

    if (!userWithRole || userWithRole.role !== "admin") {
      router.push("/account?message=Admin access required");
      return;
    }

    setAuthorized(true);
    loadResults(id);
  };

  const loadResults = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/surveys/${id}/results`);
      if (!response.ok) throw new Error("Failed to fetch results");

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Error loading results:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (anonymize: boolean = false) => {
    if (!surveyId) return;

    try {
      const url = `/api/admin/surveys/${surveyId}/export?anonymize=${anonymize}`;
      window.open(url, "_blank");
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Failed to export survey data");
    }
  };

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Survey not found</p>
      </div>
    );
  }

  const { survey, stats } = results;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/account/admin/surveys")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{survey.title}</h1>
          <p className="text-muted-foreground mt-1">Survey Results & Analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport(false)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport(true)}>
            Export Anonymous
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        {survey.status === "draft" && <Badge variant="secondary">Draft</Badge>}
        {survey.status === "active" && (
          <Badge className="bg-green-500">Active</Badge>
        )}
        {survey.status === "closed" && <Badge variant="outline">Closed</Badge>}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_sent}</div>
            <p className="text-xs text-muted-foreground">notifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Viewed</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_views}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total_sent > 0
                ? `${((stats.total_views / stats.total_sent) * 100).toFixed(1)}%`
                : "0%"}{" "}
              view rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responses</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_responses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.response_rate.toFixed(1)}% response rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.total_completed}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.completion_rate.toFixed(1)}% completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Analytics and Responses */}
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="responses">
            Responses ({stats.total_responses})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <ResultsDashboard results={results} />
        </TabsContent>

        <TabsContent value="responses">
          <ResponsesTable surveyId={survey.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

