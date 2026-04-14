"use client";

import type { Task } from "@/lib/admin/level-task-queries";
import type { Level } from "@/lib/admin/level-task-queries";
import type { TaskStatus, TaskWithStatus } from "@/lib/pathways/progress";
import type { LevelProgress } from "@/lib/pathways/queries";
import TaskNode from "./TaskNode";
import { applyTaskStatuses } from "@/lib/pathways/progress";

interface PathwayPathProps {
  levels: Array<Level & { tasks: Task[] }>;
  completedTaskIds: Set<string>;
  levelProgress?: LevelProgress[];
  onTaskClick?: (taskId: string) => void;
}

type LevelStatus = "completed" | "active" | "locked";

export default function PathwayPath({
  levels,
  completedTaskIds,
  levelProgress = [],
  onTaskClick,
}: PathwayPathProps) {
  // Flatten all tasks across levels for sequential status calculation
  const allTasks: Task[] = [];
  levels.forEach((level) => {
    const sortedTasks = [...level.tasks].sort(
      (a, b) => a.order_index - b.order_index
    );
    allTasks.push(...sortedTasks);
  });

  // Apply statuses to all tasks
  const tasksWithStatus = applyTaskStatuses(allTasks, completedTaskIds);

  // Create a map for quick task lookup
  const taskStatusMap = new Map<string, TaskWithStatus>();
  tasksWithStatus.forEach((tws) => {
    taskStatusMap.set(tws.task.id, tws);
  });

  // Helper to get level status
  const getLevelStatus = (level: Level & { tasks: Task[] }): LevelStatus => {
    const progress = levelProgress.find((lp) => lp.level_id === level.id);
    if (progress) {
      return progress.status;
    }

    // Determine from tasks
    const levelTasks = level.tasks.sort((a, b) => a.order_index - b.order_index);
    const hasCurrentOrNext = levelTasks.some((task) => {
      const status = taskStatusMap.get(task.id)?.status;
      return status === "current" || status === "next";
    });

    const allCompleted = levelTasks.every((task) =>
      completedTaskIds.has(task.id)
    );

    if (allCompleted) return "completed";
    if (hasCurrentOrNext) return "active";
    return "locked";
  };

  // Get styling for levels based on status
  const getLevelStyle = (status: LevelStatus, index: number) => {
    const baseClasses = "transition-all";
    const statusClasses = {
      completed: "opacity-60 border-muted",
      active: "border-primary/30 bg-primary/5 shadow-sm",
      locked: "opacity-50 border-muted/50",
    };

    return `${baseClasses} ${statusClasses[status]}`;
  };

  const getLevelHeaderStyle = (status: LevelStatus) => {
    const baseClasses = "text-lg font-bold mb-4";
    const statusClasses = {
      completed: "text-muted-foreground",
      active: "text-primary",
      locked: "text-muted-foreground",
    };

    return `${baseClasses} ${statusClasses[status]}`;
  };

  return (
    <div className="flex flex-col gap-8">
      {levels.map((level, levelIndex) => {
        const status = getLevelStatus(level);
        const sortedTasks = [...level.tasks].sort(
          (a, b) => a.order_index - b.order_index
        );

        return (
          <div
            key={level.id}
            className={`rounded-lg border-2 p-6 ${getLevelStyle(status, levelIndex)}`}
          >
            {/* Level Header */}
            <div className={`mb-6 ${getLevelHeaderStyle(status)}`}>
              <div className="flex items-center justify-between">
                <h3>
                  Level {level.order_index + 1}: {level.title}
                </h3>
                {status === "active" && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Active
                  </span>
                )}
              </div>
              {level.summary && (
                <p className="mt-2 text-sm font-normal text-muted-foreground">
                  {level.summary}
                </p>
              )}
            </div>

            {/* Tasks in this level */}
            <div className="relative flex flex-col gap-4">
              {sortedTasks.map((task, taskIndex) => {
                const taskWithStatus = taskStatusMap.get(task.id);
                const taskStatus = taskWithStatus?.status || "locked";

                return (
                  <div key={task.id} className="relative">
                    {/* Connector line to next task */}
                    {taskIndex < sortedTasks.length - 1 && (
                      <div
                        className={`absolute left-7 top-16 h-8 w-0.5 ${
                          taskStatus === "past" || taskStatus === "current"
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                        style={{ zIndex: 0 }}
                      />
                    )}

                    {/* Connector line to next level */}
                    {levelIndex < levels.length - 1 &&
                      taskIndex === sortedTasks.length - 1 && (
                        <div
                          className={`absolute left-7 top-16 h-8 w-0.5 ${
                            status === "completed" || status === "active"
                              ? "bg-primary/50"
                              : "bg-muted/50"
                          }`}
                          style={{ zIndex: 0 }}
                        />
                      )}

                    <div className="relative" style={{ zIndex: 1 }}>
                      <TaskNode
                        task={task}
                        status={taskStatus}
                        isKeystone={task.is_keystone}
                        onClick={
                          onTaskClick
                            ? () => onTaskClick(task.id)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

