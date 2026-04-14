"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Clock, Award, CheckCircle2, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/utils/supabase/client";
import { getTodayTask, getTaskById, type TodayTask } from "@/lib/dashboard/queries";
import { useToast } from "@/components/ui/Toasts/use-toast";

function ActionPageContent() {
  const [task, setTask] = useState<TodayTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const taskId = searchParams.get("task");

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        let fetchedTask: TodayTask | null = null;

        // If task ID is provided in URL, fetch that specific task
        if (taskId) {
          fetchedTask = await getTaskById(supabase, user.id, taskId);
        }

        // If no specific task found and no taskId in URL, try today's task
        if (!fetchedTask && !taskId) {
          fetchedTask = await getTodayTask(supabase, user.id);
        }

        setTask(fetchedTask);
      } catch (error) {
        console.error("Error fetching task:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();
  }, [supabase, taskId]);

  const handleCompleteTask = async () => {
    if (!task) return;

    setIsCompleting(true);
    try {
      // Update task instance status to completed
      const { error } = await supabase
        .from("user_task_instances")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      if (error) throw error;

      // Award XP
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("user_xp_ledger").insert({
          user_id: user.id,
          source_type: "task",
          source_id: task.taskId,
          xp_delta: task.task.xpValue,
        });
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Failed to complete task",
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="mb-4 text-muted-foreground">
                No task available right now.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="rounded-lg border-2 border-border bg-background p-6 shadow-lg">
            <div className="mb-4">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {task.pathway.title}
              </span>
            </div>

            <h1 className="mb-4 text-3xl font-bold">{task.task.title}</h1>

            <div className="mb-6 space-y-4">
              <div>
                <h2 className="mb-2 font-semibold">Objective</h2>
                <p className="text-muted-foreground">{task.task.objective}</p>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {task.task.timeMin}-{task.task.timeMax} minutes
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Award className="h-4 w-4" />
                  <span>{task.task.xpValue} XP</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border-2 border-border bg-muted/30 p-4">
                <h3 className="mb-2 font-semibold">Task Instructions</h3>
                <p className="text-sm text-muted-foreground">
                  Complete this task to earn {task.task.xpValue} XP and continue
                  your growth journey.
                </p>
              </div>

              <button
                onClick={handleCompleteTask}
                disabled={isCompleting || task.status === "completed"}
                className="w-full rounded-lg bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isCompleting ? (
                  "Completing..."
                ) : task.status === "completed" ? (
                  <>
                    <CheckCircle2 className="mr-2 inline h-5 w-5" />
                    Task Completed
                  </>
                ) : (
                  "Mark as Complete"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ActionPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-2xl">
              <div className="h-64 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <ActionPageContent />
    </Suspense>
  );
}


