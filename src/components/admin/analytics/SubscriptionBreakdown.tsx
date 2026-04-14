"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface SubscriptionData {
  status: string;
  count: number;
  percentage: number;
  [key: string]: number | string;
}

interface SubscriptionBreakdownProps {
  data: SubscriptionData[];
}

const COLORS = ["#9333ea", "#f97316", "#3b82f6", "#10b981", "#ef4444"];

export function SubscriptionBreakdown({ data }: SubscriptionBreakdownProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No subscription data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Status</CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Distribution of subscription types
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props) => {
                // PieLabelRenderProps does not include custom fields, so we map by index
                const { index } = props;
                const d = data[index!];
                if (!d) return null;
                return `${d.status}: ${d.percentage.toFixed(1)}%`;
              }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span>{item.status}</span>
              </div>
              <span className="font-medium">
                {item.count} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
