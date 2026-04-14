"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

interface ExpertiseData {
  expertise_area: string;
  count: number;
  percentage: number;
}

interface ExpertiseDistributionProps {
  data: ExpertiseData[];
}

export function ExpertiseDistribution({ data }: ExpertiseDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expertise Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No expertise data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get top 10 for display
  const topExpertise = data.slice(0, 10);

  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Expertise Distribution
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {data.length} areas
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Distribution of expert expertise across different areas
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {topExpertise.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900 truncate flex-1 mr-2">
                  {item.expertise_area}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {item.count} experts
                  </Badge>
                  <span className="text-gray-600 font-medium min-w-[3rem] text-right">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress value={item.percentage} className="h-2" />
            </div>
          ))}
        </div>

        {data.length > 10 && (
          <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
            +{data.length - 10} more expertise areas
          </div>
        )}
      </CardContent>
    </Card>
  );
}
