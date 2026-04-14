"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, DollarSign, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkRequest {
  id: string;
  project_title: string;
  project_type: string;
  client_name: string;
  expert_name: string;
  status: string;
  created_at: string;
  budget_min?: number;
  budget_max?: number;
}

interface RecentWorkRequestsProps {
  data: WorkRequest[];
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

export function RecentWorkRequests({ data }: RecentWorkRequestsProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Work Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No work requests have been made yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return "Budget not specified";
    if (min && max) {
      return `$${(min / 100).toLocaleString()} - $${(max / 100).toLocaleString()}`;
    }
    if (min) return `From $${(min / 100).toLocaleString()}`;
    if (max) return `Up to $${(max / 100).toLocaleString()}`;
    return "Budget not specified";
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-purple-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-600" />
            Recent Work Requests
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {data.length} requests
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Latest project requests from clients to experts
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.map((request) => (
            <div
              key={request.id}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {request.project_title}
                  </h4>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {request.project_type}
                    </Badge>
                  </p>
                </div>
                <Badge
                  className={`${statusColors[request.status] || "bg-gray-100 text-gray-800"} border`}
                >
                  {request.status}
                </Badge>
              </div>

              <div className="space-y-1 text-sm text-gray-600 mb-2">
                <p>
                  <span className="font-medium">Client:</span>{" "}
                  {request.client_name}
                </p>
                <p>
                  <span className="font-medium">Expert:</span>{" "}
                  {request.expert_name}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>
                    {formatBudget(request.budget_min, request.budget_max)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(request.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
