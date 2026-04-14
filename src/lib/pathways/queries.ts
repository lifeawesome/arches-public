// Pathway queries for Supabase
// Note: Requires @supabase/supabase-js to be installed
// This file provides type-safe query functions for pathway operations
//
// Hey — README points here for "how pathways think." The big idea: you pass the Supabase client in
// on purpose. Same function, totally different superpowers depending on whether it's a user's JWT
// or a service role in a cron job. If something "works in the admin script but not in the app,"
// you just found your favorite bug category.
// When someone enrolls, we freeze pathway_version off the pathway row — a little time capsule.
// If you ship breaking pathway edits, spare a thought for people mid-journey; migrations are where
// that gets spicy.
// First-task assignment is optional and deliberately soft: if task-assignment.ts hiccups, we log it
// but keep the enrollment — nobody should lose their spot because a task row sulked.
// Progress helpers stitch user_task_instances + user_level_progress; getPathwayTasksWithProgress
// is the "show me the ladder and where my feet are" view.

import { SupabaseClient } from "@supabase/supabase-js";
import { Task } from "../admin/level-task-queries";

export type Pathway = {
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

export type UserPathway = {
  id: string;
  user_id: string;
  pathway_id: string;
  pathway_version: number;
  status: "active" | "paused" | "completed";
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  pathway?: Pathway;
};

export type TaskInstance = {
  id?: string;
  user_id?: string;
  pathway_id?: string;
  task_id?: string;
  assigned_for_date?: string;
  status: "assigned" | "started" | "completed" | "skipped";
  completed_at?: string | null;
  xp_awarded?: number | null;
};

/**
 * Get all available (active) pathways
 */
export async function getAvailablePathways(
  client: SupabaseClient,
): Promise<Pathway[]> {
  const { data, error } = await client
    .from("pathways")
    .select("*")
    .eq("is_active", true)
    .order("title");

  if (error) {
    throw new Error(`Failed to fetch pathways: ${error.message}`);
  }

  return data || [];
}

/**
 * Get user's enrolled pathways
 */
export async function getUserPathways(
  client: SupabaseClient,
  userId: string,
): Promise<UserPathway[]> {
  const { data, error } = await client
    .from("user_pathways")
    .select(
      `
      *,
      pathway:pathways(*)
    `,
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user pathways: ${error.message}`);
  }

  return data || [];
}

/**
 * Enroll user in a pathway
 */
export async function enrollInPathway(
  client: SupabaseClient,
  userId: string,
  pathwayId: string,
  assignFirstTask?: boolean,
): Promise<UserPathway> {
  // First, get the pathway to get its version
  const { data: pathway, error: pathwayError } = await client
    .from("pathways")
    .select("version")
    .eq("id", pathwayId)
    .single();

  if (pathwayError || !pathway) {
    throw new Error(`Pathway not found: ${pathwayError?.message}`);
  }

  // Check if user is already enrolled
  const { data: existing } = await client
    .from("user_pathways")
    .select("id")
    .eq("user_id", userId)
    .eq("pathway_id", pathwayId)
    .single();

  if (existing) {
    throw new Error("User is already enrolled in this pathway");
  }

  // Create enrollment
  const { data, error } = await client
    .from("user_pathways")
    .insert({
      user_id: userId,
      pathway_id: pathwayId,
      pathway_version: pathway.version,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to enroll in pathway: ${error.message}`);
  }

  // Optionally assign the first task
  if (assignFirstTask) {
    try {
      const { assignFirstTaskToUser } = await import("./task-assignment");
      await assignFirstTaskToUser(client, userId, pathwayId);
    } catch (taskError) {
      // Log error but don't fail enrollment if task assignment fails
      console.error("Failed to assign first task:", taskError);
    }
  }

  return data;
}

/**
 * Unenroll user from a pathway
 * This will delete the enrollment record and optionally clean up related data
 */
export async function unenrollFromPathway(
  client: any,
  userId: string,
  pathwayId: string,
  deleteTaskInstances: boolean = false
): Promise<void> {
  // Check if user is enrolled
  const { data: enrollment, error: checkError } = await client
    .from("user_pathways")
    .select("id")
    .eq("user_id", userId)
    .eq("pathway_id", pathwayId)
    .single();

  if (checkError) {
    if (checkError.code === "PGRST116") {
      // Not found - user is not enrolled
      throw new Error("User is not enrolled in this pathway");
    }
    throw new Error(`Failed to check enrollment: ${checkError.message}`);
  }

  if (!enrollment) {
    throw new Error("User is not enrolled in this pathway");
  }

  // Optionally delete task instances for this pathway
  if (deleteTaskInstances) {
    const { error: taskError } = await client
      .from("user_task_instances")
      .delete()
      .eq("user_id", userId)
      .eq("pathway_id", pathwayId)
      .neq("status", "completed"); // Don't delete completed tasks

    if (taskError) {
      console.error("Error deleting task instances:", taskError);
      // Continue with unenrollment even if task deletion fails
    }
  }

  // Delete the enrollment record
  const { error } = await client
    .from("user_pathways")
    .delete()
    .eq("user_id", userId)
    .eq("pathway_id", pathwayId);

  if (error) {
    throw new Error(`Failed to unenroll from pathway: ${error.message}`);
  }
}

/**
 * Get a single pathway by ID
 */
export async function getPathwayById(
  client: SupabaseClient,
  pathwayId: string,
): Promise<Pathway | null> {
  const { data, error } = await client
    .from("pathways")
    .select("*")
    .eq("id", pathwayId)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new Error(`Failed to fetch pathway: ${error.message}`);
  }

  return data;
}

/**
 * Get a single pathway by slug
 */
export async function getPathwayBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<Pathway | null> {
  const { data, error } = await client
    .from("pathways")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new Error(`Failed to fetch pathway: ${error.message}`);
  }

  return data;
}

/**
 * Progress-related types
 */
export type TaskProgress = {
  task_id: string;
  status: "completed" | "in_progress" | "locked" | "not_started";
  completed_at: string | null;
  xp_awarded: number | null;
};

export type LevelProgress = {
  level_id: string;
  status: "completed" | "active" | "locked";
  completed_at: string | null;
};

/**
 * Get user's progress through a pathway
 */
export async function getPathwayProgress(
  client: SupabaseClient,
  userId: string,
  pathwayId: string,
): Promise<{
  completedTaskIds: Set<string>;
  taskProgress: TaskProgress[];
  levelProgress: LevelProgress[];
}> {
  // Get all completed task instances for this user and pathway
  const { data: taskInstances, error: taskError } = await client
    .from("user_task_instances")
    .select("task_id, status, completed_at, xp_awarded")
    .eq("user_id", userId)
    .eq("pathway_id", pathwayId)
    .eq("status", "completed");

  if (taskError) {
    throw new Error(`Failed to fetch task progress: ${taskError.message}`);
  }

  const completedTaskIds = new Set<string>(
    (taskInstances || []).map((ti: TaskInstance) => String(ti.task_id)),
  );

  // Get level progress
  const { data: levels, error: levelsError } = await client
    .from("levels")
    .select("id")
    .eq("pathway_id", pathwayId);

  if (levelsError) {
    throw new Error(`Failed to fetch levels: ${levelsError.message}`);
  }

  const levelIds = (levels || []).map((l: { id: string }) => l.id);

  const { data: levelProgress, error: levelProgressError } = await client
    .from("user_level_progress")
    .select("level_id, status, completed_at")
    .eq("user_id", userId)
    .in("level_id", levelIds);

  if (levelProgressError) {
    throw new Error(
      `Failed to fetch level progress: ${levelProgressError.message}`,
    );
  }

  const taskProgress: TaskProgress[] = (taskInstances || []).map(
    (ti: unknown | TaskInstance) => ({
      task_id: (ti as TaskInstance).task_id ?? "",
      status: "completed",
      completed_at: (ti as TaskInstance).completed_at ?? null,
      xp_awarded: (ti as TaskInstance).xp_awarded ?? null,
      pathway_id: (ti as TaskInstance).pathway_id ?? "",
    }),
  ) as TaskProgress[];

  return {
    completedTaskIds,
    taskProgress,
    levelProgress: (levelProgress || []).map((lp: LevelProgress) => ({
      level_id: lp.level_id,
      status: lp.status,
      completed_at: lp.completed_at,
    })),
  };
}

/**
 * Get all tasks for a pathway with user progress status
 */
export async function getPathwayTasksWithProgress(
  client: SupabaseClient,
  userId: string,
  pathwayId: string,
): Promise<
  Array<{
    task: Task; // Task from database
    progress: TaskProgress | null;
  }>
> {
  // First get all levels and their tasks
  const { data: levels, error: levelsError } = await client
    .from("levels")
    .select(
      `
      id,
      order_index,
      tasks:tasks(
        *,
        template_refs
      )
    `,
    )
    .eq("pathway_id", pathwayId)
    .order("order_index");

  if (levelsError) {
    throw new Error(`Failed to fetch levels: ${levelsError.message}`);
  }

  // Flatten tasks from all levels
  const allTasks: Task[] = [];
  (levels || []).forEach(
    (level: { id: string; order_index: number; tasks: Task[] }) => {
      const sortedTasks = (level.tasks || []).sort(
        (a: Task, b: Task) => a.order_index - b.order_index,
      );
      allTasks.push(...sortedTasks);
    },
  );

  // Get user's completed task instances
  const { data: taskInstances, error: taskError } = await client
    .from("user_task_instances")
    .select("task_id, status, completed_at, xp_awarded")
    .eq("user_id", userId)
    .eq("pathway_id", pathwayId);

  if (taskError) {
    throw new Error(`Failed to fetch task instances: ${taskError.message}`);
  }

  const progressMap = new Map<string, TaskProgress>();
  (taskInstances || []).forEach((ti: TaskInstance) => {
    progressMap.set(ti.task_id as string, {
      task_id: ti.task_id as string,
      status:
        ti.status === "completed"
          ? ("completed" as const)
          : ("in_progress" as const),
      completed_at: ti.completed_at as string | null,
      xp_awarded: ti.xp_awarded as number | null,
    });
  });

  return allTasks.map((task) => ({
    task: {
      ...task,
      content: task.template_refs || {},
    },
    progress: progressMap.get(task.id) || null,
  }));
}
