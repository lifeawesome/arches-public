"use client";

import { useEffect, useState } from "react";
import { Award, Flame, TrendingUp, Calendar } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/utils/supabase/client";
import { getUserXP, getUserStreak } from "@/lib/dashboard/queries";
import type { UserStreak } from "@/lib/dashboard/queries";

interface XPEntry {
  id: string;
  source_type: string;
  xp_delta: number;
  created_at: string;
}

export default function ProgressPage() {
  const [xp, setXp] = useState<number>(0);
  const [streak, setStreak] = useState<UserStreak>({
    currentStreak: 0,
    bestStreak: 0,
    lastActivityDate: null,
  });
  const [xpHistory, setXpHistory] = useState<XPEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const [xpData, streakData] = await Promise.all([
          getUserXP(supabase, user.id),
          getUserStreak(supabase, user.id),
        ]);

        setXp(xpData);
        setStreak(streakData);

        // Fetch XP history
        const { data: historyData } = await supabase
          .from("user_xp_ledger")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (historyData) {
          setXpHistory(historyData);
        }
      } catch (error) {
        console.error("Error fetching progress data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Your Progress</h1>
            <p className="text-muted-foreground">
              Track your XP, streaks, and achievements.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border-2 border-border bg-background p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>Total XP</span>
              </div>
              <div className="text-3xl font-bold text-primary">
                {xp.toLocaleString()}
              </div>
            </div>

            <div className="rounded-lg border-2 border-border bg-background p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4" />
                <span>Current Streak</span>
              </div>
              <div className="text-3xl font-bold text-primary">
                {streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : "0"}
              </div>
            </div>

            <div className="rounded-lg border-2 border-border bg-background p-6">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Best Streak</span>
              </div>
              <div className="text-3xl font-bold text-primary">
                {streak.bestStreak}
              </div>
            </div>
          </div>

          {/* XP History */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <h2 className="mb-4 text-xl font-semibold">Recent XP Activity</h2>
            {xpHistory.length > 0 ? (
              <div className="space-y-3">
                {xpHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border-2 border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/20 p-2">
                        <Award className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {entry.source_type === "task"
                            ? "Task Completed"
                            : entry.source_type === "bonus"
                              ? "Bonus XP"
                              : "Achievement"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-primary">
                      +{entry.xp_delta} XP
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No XP activity yet. Complete tasks to start earning XP!
                </p>
              </div>
            )}
          </div>

          {/* Streak Calendar Placeholder */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Streak Calendar</h2>
            </div>
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Streak calendar visualization coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}



