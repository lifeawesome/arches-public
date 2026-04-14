// Admin queries for levels and tasks
// This file provides type-safe query functions for admin operations

import { SupabaseClient } from "@supabase/supabase-js";

export type Level = {
  id: string;
  pathway_id: string;
  order_index: number;
  title: string;
  summary: string | null;
  unlock_rule_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  level_id: string;
  order_index: number;
  title: string;
  task_type: string;
  task_type_id?: string;
  time_min: number;
  time_max: number;
  objective: string;
  why_it_matters: string | null;
  instructions: string | null;
  xp_value: number;
  is_keystone: boolean;
  content?: Record<string, unknown>; // Derived from template_refs for convenience
  template_refs?: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
};

export type TaskType = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content_schema?: unknown;
};

// Task type slugs as defined in the plan
export const TASK_TYPE_SLUGS = [
  "read-text",
  "watch-video",
  "take-quiz",
  "follow-guide",
  "scavenger-hunt",
  "read-quote",
  "create-content",
  "refine-content",
  "publish-content",
  "practice-skill",
  "review-work",
  "connect-with",
] as const;

export type TaskTypeSlug = (typeof TASK_TYPE_SLUGS)[number];

/**
 * Get all levels for a pathway
 */
export async function getLevels(
  client: SupabaseClient,
  pathwayId: string,
): Promise<Level[]> {
  const { data, error } = await client
    .from("levels")
    .select("*")
    .eq("pathway_id", pathwayId)
    .order("order_index");

  if (error) {
    throw new Error(`Failed to fetch levels: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all tasks for a level
 */
export async function getTasks(
  client: SupabaseClient,
  levelId: string,
): Promise<Task[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("level_id", levelId)
    .order("order_index");

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  // Map template_refs to content for convenience
  return (data || []).map((task: Task) => ({
    ...task,
    content: task.template_refs || {},
    task_type_id: task.task_type, // Map task_type to task_type_id
  }));
}

/**
 * Get a single task by ID
 */
export async function getTask(
  client: SupabaseClient,
  taskId: string,
): Promise<Task | null> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch task: ${error.message}`);
  }

  // Map template_refs to content and task_type to task_type_id for convenience
  return data ? { 
    ...data, 
    content: data.template_refs || {},
    task_type_id: data.task_type, // Map task_type to task_type_id
  } : null;
}

/**
 * Create a new level
 */
export async function createLevel(
  client: SupabaseClient,
  pathwayId: string,
  data: { title: string; summary?: string },
): Promise<Level> {
  // Get max order_index
  const levels = await getLevels(client, pathwayId);
  const maxOrder =
    levels.length > 0 ? Math.max(...levels.map((l) => l.order_index)) : -1;

  const { data: newLevel, error } = await client
    .from("levels")
    .insert({
      pathway_id: pathwayId,
      title: data.title,
      summary: data.summary || null,
      order_index: maxOrder + 1,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create level: ${error.message}`);
  }

  return newLevel;
}

/**
 * Update a level
 */
export async function updateLevel(
  client: SupabaseClient,
  levelId: string,
  updates: Partial<Level>,
): Promise<Level> {
  const { data, error } = await client
    .from("levels")
    .update(updates)
    .eq("id", levelId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update level: ${error.message}`);
  }

  return data;
}

/**
 * Delete a level
 */
export async function deleteLevel(
  client: SupabaseClient,
  levelId: string,
): Promise<void> {
  const { error } = await client.from("levels").delete().eq("id", levelId);

  if (error) {
    throw new Error(`Failed to delete level: ${error.message}`);
  }
}

/**
 * Create a new task
 */
export async function createTask(
  client: SupabaseClient,
  levelId: string,
  data: {
    title: string;
    task_type_id: string;
    objective: string;
    time_min?: number;
    time_max?: number;
    why_it_matters?: string;
    instructions?: string;
    xp_value?: number;
    is_keystone?: boolean;
    content?: Record<string, unknown>;
  },
): Promise<Task> {
  // Get max order_index
  const tasks = await getTasks(client, levelId);
  const maxOrder =
    tasks.length > 0 ? Math.max(...tasks.map((t) => t.order_index)) : -1;

  const { data: newTask, error } = await client
    .from("tasks")
    .insert({
      level_id: levelId,
      title: data.title,
      task_type: data.task_type_id, // Assuming task_type_id maps to task_type enum
      objective: data.objective,
      time_min: data.time_min || 15,
      time_max: data.time_max || 30,
      why_it_matters: data.why_it_matters || null,
      instructions: data.instructions || null,
      xp_value: data.xp_value || 25,
      is_keystone: data.is_keystone || false,
      template_refs: data.content ?? {},
      order_index: maxOrder + 1,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return newTask;
}

/**
 * Update a task
 */
export async function updateTask(
  client: SupabaseClient,
  taskId: string,
  updates: {
    title?: string;
    task_type_id?: string;
    objective?: string;
    time_min?: number;
    time_max?: number;
    why_it_matters?: string;
    instructions?: string;
    xp_value?: number;
    is_keystone?: boolean;
    content?: Record<string, unknown>;
  },
): Promise<Task> {
  const updateData: Partial<Task> = { ...updates };
  if (updates.task_type_id) {
    updateData.task_type = updates.task_type_id;
    delete updateData.task_type_id;
  }

  // Store content in template_refs
  if (updates.content !== undefined) {
    updateData.template_refs = updates.content;
    delete updateData.content;
  }

  const { data, error } = await client
    .from("tasks")
    .update(updateData)
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`);
  }

  // Map template_refs to content and task_type to task_type_id for convenience
  return { 
    ...data, 
    content: data.template_refs || {},
    task_type_id: data.task_type, // Map task_type to task_type_id
  };
}

/**
 * Delete a task
 */
export async function deleteTask(
  client: SupabaseClient,
  taskId: string,
): Promise<void> {
  const { error } = await client.from("tasks").delete().eq("id", taskId);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }
}
