"use client";

import { useEffect, useState } from "react";
import { SurveyResponse } from "@/types/survey";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface ResponsesTableProps {
  surveyId: string;
}

export function ResponsesTable({ surveyId }: ResponsesTableProps) {
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadResponses();
  }, [surveyId, page]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/surveys/${surveyId}/responses?page=${page}&limit=${limit}`
      );
      if (!response.ok) throw new Error("Failed to fetch responses");

      const data = await response.json();
      setResponses(data.responses || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Error loading responses:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading responses...</p>
        </CardContent>
      </Card>
    );
  }

  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No responses yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Responses</CardTitle>
        <CardDescription>
          {total} total response(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {responses.map((response) => {
              const profile = response.profiles;
              return (
                <TableRow key={response.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {profile?.full_name || "Anonymous"}
                      </div>
                      {profile?.email && (
                        <div className="text-sm text-muted-foreground">
                          {profile.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {response.completed_at ? (
                      <Badge className="bg-green-500">Completed</Badge>
                    ) : (
                      <Badge variant="secondary">In Progress</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(response.started_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    {response.completed_at
                      ? format(new Date(response.completed_at), "MMM d, yyyy h:mm a")
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

