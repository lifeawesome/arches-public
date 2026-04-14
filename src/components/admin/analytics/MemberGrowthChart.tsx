"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MemberGrowthData {
  date: string;
  members: number;
  newMembers: number;
}

interface MemberGrowthChartProps {
  data: MemberGrowthData[];
}

export function MemberGrowthChart({ data }: MemberGrowthChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Member Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No growth data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Growth Over Time</CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Total members and new member signups
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="members"
              stroke="#9333ea"
              strokeWidth={2}
              name="Total Members"
            />
            <Line
              type="monotone"
              dataKey="newMembers"
              stroke="#f97316"
              strokeWidth={2}
              name="New Members"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
