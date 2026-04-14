"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { createClient } from "@/utils/supabase/client";
import { Edit, Loader2, Clock, Target, Lock } from "lucide-react";
import { getPathwayImageUrl } from "@/lib/utils/pathway-image";

type Pathway = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  outcomes: string[];
  difficulty: number;
  estimated_days: number | null;
  is_active: boolean;
  version: number;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
};

type Level = {
  id: string;
  pathway_id: string;
  order_index: number;
  title: string;
  summary: string | null;
  unlock_rule_id: string | null;
};

type Task = {
  id: string;
  level_id: string;
  order_index: number;
  title: string;
  task_type: string;
  time_min: number;
  time_max: number;
  objective: string;
  why_it_matters: string | null;
  xp_value: number;
  is_keystone: boolean;
};

const difficultyLabels = [
  "",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
  "Master",
];

const taskTypeLabels: Record<string, string> = {
  create: "Create",
  refine: "Refine",
  publish: "Publish",
  practice: "Practice",
  review: "Review",
  connect: "Connect",
};

export default function PathwayPreviewPage() {
  const params = useParams();
  const pathwayId = params.id as string;
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [tasksByLevel, setTasksByLevel] = useState<Record<string, Task[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch pathway (admin can view inactive pathways)
        const { data: pathwayData, error: pathwayError } = await supabase
          .from("pathways")
          .select("*")
          .eq("id", pathwayId)
          .single();

        if (pathwayError) {
          console.error("Pathway fetch error:", pathwayError);
          setError(`Failed to load pathway: ${pathwayError.message}`);
          setIsLoading(false);
          return;
        }

        if (!pathwayData) {
          setError("Pathway not found");
          setIsLoading(false);
          return;
        }

        setPathway(pathwayData);

        // Fetch levels
        const { data: levelsData, error: levelsError } = await supabase
          .from("levels")
          .select("*")
          .eq("pathway_id", pathwayId)
          .order("order_index", { ascending: true });

        if (levelsError) {
          console.error("Error fetching levels:", levelsError);
        } else {
          setLevels(levelsData || []);
        }

        // Fetch tasks for each level
        if (levelsData && levelsData.length > 0) {
          const levelIds = levelsData.map((l: Level) => l.id);
          const { data: tasksData, error: tasksError } = await supabase
            .from("tasks")
            .select("*")
            .in("level_id", levelIds)
            .order("level_id", { ascending: true })
            .order("order_index", { ascending: true });

          if (tasksError) {
            console.error("Error fetching tasks:", tasksError);
          } else {
            // Group tasks by level_id
            const grouped: Record<string, Task[]> = {};
            (tasksData || []).forEach((task: Task) => {
              if (!grouped[task.level_id]) {
                grouped[task.level_id] = [];
              }
              grouped[task.level_id].push(task);
            });
            setTasksByLevel(grouped);
          }
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load pathway data");
      } finally {
        setIsLoading(false);
      }
    };

    if (pathwayId) {
      fetchData();
    }
  }, [pathwayId, supabase]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8 flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading pathway preview...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !pathway) {
    return (
      <AdminLayout>
        <div className="p-8 max-w-4xl">
          <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-6">
            <p className="text-destructive font-semibold mb-4">
              {error || "Pathway not found"}
            </p>
            <Link
              href="/admin/pathways"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Back to Pathways
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const totalTasks = Object.values(tasksByLevel).reduce(
    (sum, tasks) => sum + tasks.length,
    0
  );

  const resolvedImageUrl = getPathwayImageUrl(pathway.cover_image_url);

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Admin Header Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!pathway.is_active && (
              <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                Inactive (Preview Only)
              </span>
            )}
          </div>
          <Link
            href={`/admin/pathways/${pathwayId}`}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Edit className="h-4 w-4" />
            Edit Pathway
          </Link>
        </div>

        {/* Pathway Hero */}
        <div className="relative border-b-2 border-border">
          <div className="relative h-64 w-full overflow-hidden bg-muted md:h-96">
            <Image
              src={resolvedImageUrl}
              alt={pathway.title}
              fill
              className="object-cover"
              priority
              unoptimized={
                resolvedImageUrl.includes("127.0.0.1") ||
                resolvedImageUrl.includes("localhost") ||
                resolvedImageUrl.includes("supabase") ||
                resolvedImageUrl.startsWith("data:")
              }
            />
          </div>
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold mb-4 md:text-5xl">
                {pathway.title}
              </h1>
              {pathway.summary && (
                <p className="text-lg text-muted-foreground mb-6">
                  {pathway.summary}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {pathway.difficulty && (
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {difficultyLabels[pathway.difficulty] ||
                        `Level ${pathway.difficulty}`}
                    </span>
                  </div>
                )}
                {pathway.estimated_days && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      ~{pathway.estimated_days} days
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {levels.length} levels • {totalTasks} tasks
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Outcomes */}
        {pathway.outcomes && pathway.outcomes.length > 0 && (
          <div className="border-b-2 border-border bg-muted/30">
            <div className="container mx-auto px-4 py-6">
              <div className="max-w-3xl">
                <h2 className="text-xl font-semibold mb-4">What You&apos;ll Learn</h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {pathway.outcomes.map((outcome, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="mt-1 text-primary">✓</span>
                      <span className="text-muted-foreground">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Levels and Tasks */}
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl">
            {levels.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-12 text-center">
                <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">No levels yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add levels and tasks to this pathway to see them here.
                </p>
                <Link
                  href={`/admin/pathways/${pathwayId}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Edit className="h-4 w-4" />
                  Edit Pathway
                </Link>
              </div>
            ) : (
              <div className="space-y-8">
                {levels.map((level, levelIdx) => {
                  const levelTasks = tasksByLevel[level.id] || [];
                  return (
                    <div
                      key={level.id}
                      className="rounded-lg border-2 border-border bg-background p-6"
                    >
                      <div className="mb-4 flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                          {level.order_index}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-2xl font-semibold mb-2">
                            {level.title}
                          </h3>
                          {level.summary && (
                            <p className="text-muted-foreground">
                              {level.summary}
                            </p>
                          )}
                        </div>
                      </div>

                      {levelTasks.length === 0 ? (
                        <div className="ml-14 rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                          No tasks in this level yet
                        </div>
                      ) : (
                        <div className="ml-14 space-y-3">
                          {levelTasks.map((task, taskIdx) => (
                            <div
                              key={task.id}
                              className="rounded-lg border-2 border-border bg-muted/30 p-4"
                            >
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-medium text-primary">
                                      {taskTypeLabels[task.task_type] ||
                                        task.task_type}
                                    </span>
                                    {task.is_keystone && (
                                      <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                                        Keystone
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-semibold">{task.title}</h4>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {task.time_min}-{task.time_max} min
                                </div>
                              </div>
                              <p className="mb-2 text-sm text-muted-foreground">
                                {task.objective}
                              </p>
                              {task.why_it_matters && (
                                <p className="text-xs italic text-muted-foreground">
                                  Why it matters: {task.why_it_matters}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                                  +{task.xp_value} XP
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

