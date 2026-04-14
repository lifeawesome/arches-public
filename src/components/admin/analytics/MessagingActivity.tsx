"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface MessagingActivityProps {
  data: {
    date: string;
    messages: number;
    conversations: number;
  }[];
}

export function MessagingActivity({ data }: MessagingActivityProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Messaging Activity</CardTitle>
          <CardDescription>Conversations over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No messaging data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxConversations = Math.max(...data.map((d) => d.conversations), 1);
  const totalConversations = data.reduce((sum, d) => sum + d.conversations, 0);
  const avgPerDay = totalConversations / data.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              <CardTitle>Messaging Activity</CardTitle>
            </div>
            <CardDescription>New conversations started</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {totalConversations}
            </div>
            <div className="text-sm text-gray-500">total conversations</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Bar chart */}
          <div className="space-y-2">
            {data.slice(-10).map((point, index) => {
              const width = (point.conversations / maxConversations) * 100;
              return (
                <div key={index} className="group">
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 w-20 text-right">
                      {new Date(point.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="flex-1 relative">
                      <div
                        className="h-8 bg-purple-500 rounded hover:bg-purple-600 transition-all cursor-pointer relative"
                        style={{ width: `${Math.max(width, 5)}%` }}
                      >
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-white">
                          {point.conversations}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-bold text-gray-900">
                {totalConversations}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Daily Average</div>
              <div className="text-lg font-bold text-purple-600">
                {avgPerDay.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

