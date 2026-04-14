"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SkillData {
  skill: string;
  count: number;
  experts: number;
}

interface SkillsTagCloudProps {
  data: SkillData[];
}

export function SkillsTagCloud({ data }: SkillsTagCloudProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skills Tag Cloud</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No skills data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate min and max for scaling
  const counts = data.map((d) => d.count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  // Function to calculate font size based on count
  const getFontSize = (count: number) => {
    if (maxCount === minCount) return 16;
    const normalized = (count - minCount) / (maxCount - minCount);
    return 12 + normalized * 20; // Range from 12px to 32px
  };

  // Function to get color based on count
  const getColor = (count: number) => {
    if (maxCount === minCount) return "text-purple-600";
    const normalized = (count - minCount) / (maxCount - minCount);
    if (normalized > 0.7) return "text-purple-700 font-bold";
    if (normalized > 0.4) return "text-purple-600 font-semibold";
    return "text-purple-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Skills Tag Cloud
          <Badge variant="secondary" className="text-xs">
            {data.length} skills
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Most common skills across all experts. Size indicates frequency.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 p-4 bg-gradient-to-br from-purple-50 to-orange-50 rounded-lg min-h-[300px] items-center justify-center">
          {data.map((skill, index) => (
            <div
              key={index}
              className="inline-block transition-all hover:scale-110 cursor-default"
              title={`${skill.count} mentions • ${skill.experts} experts`}
            >
              <span
                className={`${getColor(skill.count)} transition-all`}
                style={{
                  fontSize: `${getFontSize(skill.count)}px`,
                  lineHeight: 1.5,
                }}
              >
                {skill.skill}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 px-2">
          <div className="flex items-center gap-2">
            <span className="text-purple-500">Small</span>
            <span>→</span>
            <span className="text-purple-700 font-bold">Large</span>
          </div>
          <span>indicates frequency</span>
        </div>
      </CardContent>
    </Card>
  );
}
