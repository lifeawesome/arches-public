"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Trophy } from "lucide-react";
import Link from "next/link";

interface TopExpertsProps {
  data: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    messageCount: number;
  }[];
}

export function TopExperts({ data }: TopExpertsProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Experts</CardTitle>
          <CardDescription>Most active and valuable experts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No expert data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-orange-600" />
          <div>
            <CardTitle>Top Performing Experts</CardTitle>
            <CardDescription>
              Most active experts by conversation count
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((expert, index) => (
            <Link
              key={expert.id}
              href={`/members/${expert.id}`}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {/* Rank Badge */}
              <div className="flex-shrink-0">
                {index < 3 ? (
                  <div
                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${
                      index === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : index === 1
                          ? "bg-gray-200 text-gray-700"
                          : "bg-orange-100 text-orange-700"
                    }
                  `}
                  >
                    {index + 1}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                )}
              </div>

              {/* Avatar */}
              <SmartAvatar
                src={expert.avatar_url}
                alt={expert.name}
                size={48}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                  {expert.name}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {expert.email}
                </div>
              </div>

              {/* Message Count */}
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" />
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200"
                >
                  {expert.messageCount} conversations
                </Badge>
              </div>
            </Link>
          ))}

          {data.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No expert activity yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
