"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  CreditCard,
  XCircle,
  MessageSquare,
  Clock,
} from "lucide-react";

interface RecentActivityProps {
  data: {
    type: "signup" | "subscription" | "cancellation" | "message";
    description: string;
    timestamp: string;
    userEmail?: string;
  }[];
}

const ACTIVITY_CONFIG = {
  signup: {
    icon: UserPlus,
    color: "text-green-600",
    bg: "bg-green-100",
    label: "New Signup",
  },
  subscription: {
    icon: CreditCard,
    color: "text-blue-600",
    bg: "bg-blue-100",
    label: "New Subscription",
  },
  cancellation: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-100",
    label: "Cancellation",
  },
  message: {
    icon: MessageSquare,
    color: "text-purple-600",
    bg: "bg-purple-100",
    label: "Message",
  },
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = now.getTime() - time.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function RecentActivity({ data }: RecentActivityProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No recent activity
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest member and platform activity
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((activity, index) => {
            const config = ACTIVITY_CONFIG[activity.type];
            const Icon = config.icon;

            return (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Icon */}
                <div className={`p-2 rounded-lg ${config.bg}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`${config.bg} ${config.color} border-none text-xs`}
                    >
                      {config.label}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {activity.description}
                  </p>
                  {activity.userEmail && (
                    <p className="text-xs text-gray-500 mt-1">
                      {activity.userEmail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

