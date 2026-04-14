"use client";

import { AnswerBreakdown, QuestionAnalytics, SurveyResultsResponse } from "@/types/survey";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface ResultsDashboardProps {
  results: SurveyResultsResponse;
}

const COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5", "#3b82f6", "#60a5fa", "#93c5fd"];

export function ResultsDashboard({ results }: ResultsDashboardProps) {
  const { questions, analytics } = results;

  const renderQuestionAnalytics = (questionAnalytics: QuestionAnalytics, index: number) => {
    const { question_text, question_type, breakdown, total_responses } =
      questionAnalytics;

    return (
      <Card key={index}>
        <CardHeader>
          <CardTitle className="text-lg">
            Q{index + 1}: {question_text}
          </CardTitle>
          <CardDescription>
            {total_responses} response(s) • {question_type.replace(/_/g, " ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(question_type === "multiple_choice" ||
            question_type === "checkboxes") && (
              <div className="space-y-6">
                {/* Bar Chart */}
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={breakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="value" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#f97316" name="Responses" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Pie Chart */}
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={breakdown as unknown as { value: string, count: number, percentage: number }[]}
                      dataKey="count"
                      nameKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.value} (${entry.percent?.toFixed(1)}%)`}
                    >
                      {breakdown.map((entry: unknown, i: number) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                {/* Breakdown Table */}
                <div className="space-y-2">
                  {breakdown.map((item: AnswerBreakdown, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <span className="font-medium">{item.value}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {item.count} votes
                        </span>
                        <span className="text-sm font-bold">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {(question_type === "rating" || question_type === "scale") && (
            <div className="space-y-6">
              {/* Bar Chart for Ratings */}
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={breakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="value" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#f97316" name="Responses" />
                </BarChart>
              </ResponsiveContainer>

              {/* Average */}
              <Card className="bg-orange-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-orange-600">
                      {breakdown.length > 0
                        ? (
                          breakdown.reduce(
                            (sum: number, item: AnswerBreakdown) =>
                              sum + Number(item.value) * Number(item.count),
                            0
                          ) / total_responses
                        ).toFixed(2)
                        : "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Average Rating
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {(question_type === "text" || question_type === "long_text") && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold">{total_responses}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Text Responses
                    </div>
                  </div>
                </CardContent>
              </Card>
              <p className="text-sm text-muted-foreground">
                View individual text responses in the &quot;Responses&quot; tab
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (analytics.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No responses yet. Check back once users start responding to the survey.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {analytics.map((questionAnalytics, index) =>
        renderQuestionAnalytics(questionAnalytics, index)
      )}
    </div>
  );
}

