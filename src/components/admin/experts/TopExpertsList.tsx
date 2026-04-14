"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Star, MessageSquare, CheckCircle } from "lucide-react";

interface TopExpert {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  expertise_area: string;
  total_skills: number;
  is_verified: boolean;
  message_count: number;
  profile_completeness_score: number;
}

interface TopExpertsListProps {
  data: TopExpert[];
}

export function TopExpertsList({ data }: TopExpertsListProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Experts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No experts found.</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-gray-600 bg-gray-100";
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-purple-600" />
            Top Experts
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {data.length} experts
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Ranked by profile completeness and engagement
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.map((expert, index) => (
            <div
              key={expert.id}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Rank Badge */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0
                      ? "bg-yellow-100 text-yellow-700"
                      : index === 1
                        ? "bg-gray-200 text-gray-700"
                        : index === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Avatar */}
                <SmartAvatar
                  src={expert.avatar_url}
                  alt={expert.name}
                  size={40}
                  className="flex-shrink-0"
                />

                {/* Expert Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {expert.name}
                    </h4>
                    {expert.is_verified && (
                      <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-2 truncate">
                    {expert.expertise_area}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-600">
                        {expert.message_count} conversations
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {expert.total_skills} skills
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Profile Score */}
                <div className="flex-shrink-0 text-right">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getScoreColor(expert.profile_completeness_score)}`}
                  >
                    <span className="text-sm font-bold">
                      {expert.profile_completeness_score}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
