"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Target, Zap, TrendingUp, Award, Flame, BookOpen, Users } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardTour } from "@/components/dashboard/DashboardTour";
import { createClient } from "@/utils/supabase/client";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  getTodayTask,
  getUserXP,
  getUserStreak,
  type TodayTask,
} from "@/lib/dashboard/queries";
import { getUserPathways, UserPathway } from "@/lib/pathways/queries";

export default function DashboardPage() {
  const [todayTask, setTodayTask] = useState<TodayTask | null>(null);
  const [xp, setXp] = useState<number>(0);
  const [streak, setStreak] = useState({ currentStreak: 0, bestStreak: 0 });
  const [userPathways, setUserPathways] = useState<UserPathway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [circleDraftCount, setCircleDraftCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const [task, xpData, streakData, pathways] = await Promise.all([
          getTodayTask(supabase, user.id),
          getUserXP(supabase, user.id),
          getUserStreak(supabase, user.id),
          getUserPathways(supabase, user.id),
        ]);

        setTodayTask(task);
        setXp(xpData);
        setStreak(streakData);
        setUserPathways(pathways);

        // Check if this is first session (no completed tasks)
        const { data: completedTasks } = await supabase
          .from("user_task_instances")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .limit(1);

        setIsFirstSession(completedTasks?.length === 0);

        try {
          const draftRes = await fetch("/api/circles/my-drafts-count");
          if (draftRes.ok) {
            const d = (await draftRes.json()) as { draft_count?: number };
            setCircleDraftCount(d.draft_count ?? 0);
          }
        } catch {
          // ignore
        }

        // Check if we should show the tour
        if (completedTasks?.length === 0 && typeof window !== "undefined") {
          const tourCompleted = localStorage.getItem("arches_dashboard_tour_completed");
          if (!tourCompleted) {
            setShowTour(true);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardTour run={showTour && !isLoading} onComplete={() => setShowTour(false)} />
      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* First Session Welcome Banner */}
          {isFirstSession && !todayTask && (
            <div data-tour="welcome-card" className="rounded-lg border-2 border-primary bg-primary/10 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/20 p-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold">Welcome to Arches!</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    You&apos;re all set up! To get started, choose a pathway and complete your first daily action.
                  </p>
                  <Link
                    href="/dashboard/paths"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Browse Pathways
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* First Session with Task */}
          {isFirstSession && todayTask && (
            <div className="rounded-lg border-2 border-primary bg-primary/10 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-primary/20 p-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-lg font-semibold">Ready for your first action?</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Complete your first task to start earning XP and building your streak!
                  </p>
                  <Link
                    href={`/dashboard/action?task=${todayTask.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Start Your First Task
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Today's Action Card - Hero */}
          {todayTask ? (
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-6 shadow-lg">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="mb-2 text-2xl font-bold">Today&apos;s Action</h2>
                  <p className="text-muted-foreground">
                    {todayTask.pathway.title}
                  </p>
                </div>
                <div className="rounded-full bg-primary/20 p-3">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>

              <div className="mb-4">
                <h3 className="mb-2 text-xl font-semibold">
                  {todayTask.task.title}
                </h3>
                <p className="text-muted-foreground">
                  {todayTask.task.objective}
                </p>
              </div>

              <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    {todayTask.task.timeMin}-{todayTask.task.timeMax} min
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="h-4 w-4" />
                  <span>{todayTask.task.xpValue} XP</span>
                </div>
              </div>

              <Link
                href={`/dashboard/action?task=${todayTask.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start Task
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30" data-tour="no-task">
              <Empty variant="spacious">
                <EmptyHeader>
                  <EmptyMedia variant="icon" size="lg">
                    <Target className="h-16 w-16 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle>No Task Assigned</EmptyTitle>
                  <EmptyDescription>
                    Choose a pathway to get started with your daily actions. Your first task will appear here once you&apos;re enrolled.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/dashboard/paths">
                      Browse Pathways
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          )}

          {/* My Circles shortcut */}
          <div className="rounded-lg border-2 border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">My Circles</h3>
                <p className="text-sm text-muted-foreground">
                  Manage circles you own and circles you’ve joined.
                  {circleDraftCount > 0 ? (
                    <span className="mt-1 block text-foreground">
                      You have {circleDraftCount} circle post draft{circleDraftCount === 1 ? "" : "s"} saved.
                    </span>
                  ) : null}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/dashboard/circles" className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Open
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Progress Summary */}
          <div data-tour="xp-streak" className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-border bg-background p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Total XP</span>
              </div>
              {xp > 0 ? (
                <div className="text-2xl font-bold text-primary">
                  {xp.toLocaleString()}
                </div>
              ) : (
                <Empty variant="compact" className="py-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" size="sm">
                      <Award className="h-8 w-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">No XP Yet</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Complete your first task to start earning XP and leveling up.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>

            <div className="rounded-lg border-2 border-border bg-background p-4" data-tour="xp-streak">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="h-4 w-4" />
                <span>Current Streak</span>
              </div>
              {streak.currentStreak > 0 ? (
                <>
                  <div className="text-2xl font-bold text-primary">
                    🔥 {streak.currentStreak}
                  </div>
                  {streak.bestStreak > streak.currentStreak && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Best: {streak.bestStreak}
                    </div>
                  )}
                </>
              ) : (
                <Empty variant="compact" className="py-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" size="sm">
                      <Flame className="h-8 w-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">No Streak Yet</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Complete a task today to start your streak and build momentum.
                    </EmptyDescription>
                  </EmptyHeader>
                  {todayTask && (
                    <EmptyContent>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/action?task=${todayTask.id}`}>
                          Start Today&apos;s Task
                        </Link>
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )}
            </div>
          </div>

          {/* Active Pathways */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <h3 className="mb-4 text-lg font-semibold">Your Pathways</h3>
            {userPathways.length > 0 ? (
              <>
                <div className="space-y-3">
                  {userPathways.slice(0, 3).map((userPathway) => {
                    const pathway = userPathway.pathway;
                    if (!pathway) return null;

                    return (
                      <Link
                        key={userPathway.id}
                        href={`/pathways/${pathway.slug}`}
                        className="flex items-center justify-between rounded-lg border-2 border-border bg-muted/30 p-4 transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold">{pathway.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {userPathway.status}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
                {userPathways.length > 3 && (
                  <Link
                    href="/dashboard/paths"
                    className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
                  >
                    View All Pathways →
                  </Link>
                )}
              </>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30">
                <Empty variant="default">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BookOpen className="h-12 w-12 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle>No Pathways Selected</EmptyTitle>
                    <EmptyDescription>
                      Your pathways will appear here. Choose your first one to begin your expert journey and start receiving daily actions.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button asChild>
                      <Link href="/dashboard/paths">
                        Browse Pathways
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </EmptyContent>
                </Empty>
              </div>
            )}
          </div>

          {/* Momentum Cues */}
          {streak.currentStreak > 0 && (
            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/20 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Keep the momentum going!</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;re on a {streak.currentStreak}-day streak. Complete
                    today&apos;s task to keep it alive.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
