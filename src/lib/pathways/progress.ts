// Progress utilities for determining task and level states

import type { TaskProgress, LevelProgress } from "./queries";
import type { Task } from "@/lib/admin/level-task-queries";

export type TaskStatus = "past" | "current" | "next" | "locked";

export interface TaskWithStatus {
  task: Task;
  status: TaskStatus;
  progress: TaskProgress | null;
}

/**
 * Determine task status based on completion and sequential ordering
 */
export function getTaskStatus(
  task: Task,
  taskIndex: number,
  allTasks: Task[],
  completedTaskIds: Set<string>
): TaskStatus {
  // If task is completed, it's in the past
  if (completedTaskIds.has(task.id)) {
    return "past";
  }

  // Check if all previous tasks are completed
  const allPreviousCompleted = allTasks
    .slice(0, taskIndex)
    .every((t) => completedTaskIds.has(t.id));

  if (!allPreviousCompleted) {
    return "locked";
  }

  // Find the first incomplete task (current task)
  const currentTaskIndex = allTasks.findIndex(
    (t) => !completedTaskIds.has(t.id)
  );

  if (currentTaskIndex === taskIndex) {
    return "current";
  }

  if (currentTaskIndex === taskIndex - 1) {
    return "next";
  }

  // If we're before the current task, we're locked
  // If we're after the current task but more than one away, we're locked
  if (taskIndex < currentTaskIndex || taskIndex > currentTaskIndex + 1) {
    return "locked";
  }

  return "locked";
}

/**
 * Get current active task from list of tasks
 */
export function getCurrentTask(
  tasks: Task[],
  completedTaskIds: Set<string>
): Task | null {
  return (
    tasks.find((task) => !completedTaskIds.has(task.id)) || null
  );
}

/**
 * Get next task after current
 */
export function getNextTask(
  tasks: Task[],
  completedTaskIds: Set<string>
): Task | null {
  const currentTask = getCurrentTask(tasks, completedTaskIds);
  if (!currentTask) {
    // All tasks completed, no next task
    return null;
  }

  const currentIndex = tasks.findIndex((t) => t.id === currentTask.id);
  if (currentIndex < tasks.length - 1) {
    return tasks[currentIndex + 1];
  }

  return null;
}

/**
 * Calculate level completion percentage
 */
export function calculateLevelProgress(
  levelTasks: Task[],
  completedTaskIds: Set<string>
): number {
  if (levelTasks.length === 0) {
    return 0;
  }

  const completedCount = levelTasks.filter((task) =>
    completedTaskIds.has(task.id)
  ).length;

  return Math.round((completedCount / levelTasks.length) * 100);
}

/**
 * Get level status based on tasks and progress
 */
export function getLevelStatus(
  levelTasks: Task[],
  completedTaskIds: Set<string>,
  levelProgress: LevelProgress | undefined
): "completed" | "active" | "locked" {
  // If we have explicit level progress, use it
  if (levelProgress) {
    return levelProgress.status;
  }

  // Otherwise determine from tasks
  if (levelTasks.length === 0) {
    return "locked";
  }

  const allCompleted = levelTasks.every((task) =>
    completedTaskIds.has(task.id)
  );
  if (allCompleted) {
    return "completed";
  }

  // Check if any task in this level is current or next
  const hasCurrentOrNext = levelTasks.some((task, index, allTasks) => {
    const status = getTaskStatus(task, index, allTasks, completedTaskIds);
    return status === "current" || status === "next";
  });

  if (hasCurrentOrNext) {
    return "active";
  }

  // Check if all previous levels are completed (simplified - would need full pathway context)
  return "locked";
}

/**
 * Apply status to all tasks in a pathway
 */
export function applyTaskStatuses(
  tasks: Task[],
  completedTaskIds: Set<string>
): TaskWithStatus[] {
  return tasks.map((task, index) => ({
    task,
    status: getTaskStatus(task, index, tasks, completedTaskIds),
    progress: null, // Progress would be populated separately
  }));
}



