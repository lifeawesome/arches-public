"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SurveyWithStats } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, BarChart, Edit, Trash2, Send, Archive } from "lucide-react";
import { format } from "date-fns";

export default function SurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    active: 0,
    closed: 0,
  });

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      const response = await fetch("/api/admin/surveys");
      if (!response.ok) throw new Error("Failed to fetch surveys");

      const data = await response.json();
      setSurveys(data.surveys || []);

      // Calculate stats
      const total = data.surveys?.length || 0;
      const draft = data.surveys?.filter((s: SurveyWithStats) => s.status === "draft").length || 0;
      const active = data.surveys?.filter((s: SurveyWithStats) => s.status === "active").length || 0;
      const closed = data.surveys?.filter((s: SurveyWithStats) => s.status === "closed").length || 0;

      setStats({ total, draft, active, closed });
    } catch (error) {
      console.error("Error loading surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this survey?")) return;

    try {
      const response = await fetch(`/api/admin/surveys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete survey");

      loadSurveys();
    } catch (error) {
      console.error("Error deleting survey:", error);
      alert("Failed to delete survey");
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm("Are you sure you want to publish this survey and send notifications?")) return;

    try {
      const response = await fetch(`/api/admin/surveys/${id}/publish`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to publish survey");

      const data = await response.json();
      alert(`Survey published! ${data.notifications_sent} notifications sent.`);
      loadSurveys();
    } catch (error) {
      console.error("Error publishing survey:", error);
      alert("Failed to publish survey");
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm("Are you sure you want to close this survey?")) return;

    try {
      const response = await fetch(`/api/admin/surveys/${id}/close`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to close survey");

      loadSurveys();
    } catch (error) {
      console.error("Error closing survey:", error);
      alert("Failed to close survey");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "closed":
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Loading surveys...</p>
          </div>
        ) : (
          <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Surveys</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage user research surveys
          </p>
        </div>
        <Button onClick={() => router.push("/admin/surveys/new")}>
          <Plus className="mr-2 h-4 w-4" />
          New Survey
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Surveys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Closed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Surveys Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Surveys</CardTitle>
          <CardDescription>
            Manage your surveys and view response rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {surveys.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No surveys yet</p>
              <Button onClick={() => router.push("/admin/surveys/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Survey
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Response Rate</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell className="font-medium">{survey.title}</TableCell>
                    <TableCell>{getStatusBadge(survey.status)}</TableCell>
                    <TableCell>
                      {survey.stats.total_completed} / {survey.stats.total_sent}
                    </TableCell>
                    <TableCell>
                      {survey.stats.response_rate.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {format(new Date(survey.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/admin/surveys/${survey.id}/results`)
                          }
                        >
                          <BarChart className="h-4 w-4" />
                        </Button>
                        {survey.status === "draft" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/admin/surveys/${survey.id}/edit`)
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublish(survey.id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {survey.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClose(survey.id)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(survey.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

