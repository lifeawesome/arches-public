// Task assignment helper functions
// Used to assign the first task to a user when they enroll in a pathway
//
// Small file, loud implications (README sends folks here). "First task" is literally: sort levels,
// take the first, sort its tasks, take the first — all via order_index in the admin query helpers.
// Reorder in the CMS and new enrollments quietly change shape; that's usually what you want, just
// know you're holding the lever.
// We key instances by calendar day in UTC (assigned_for_date). Try to assign the same first task
// twice the same day and you'll get the existing row back — idempotent-ish, not angry duplicates.
// This is the "welcome aboard" write to user_task_instances. What happens after someone finishes a
// task lives in other corners of the codebase — go grepping if you're extending the journey.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLevels } from "@/lib/admin/level-task-queries";
import { getTasks } from "@/lib/admin/level-task-queries";

/**
 * Assign the first task from a pathway to a user for today
 * Returns the task instance ID if successful
 */
export async function assignFirstTaskToUser(
  client: SupabaseClient,
  userId: string,
  pathwayId: string
): Promise<string | null> {
  try {
    // Get all levels for the pathway, ordered by order_index
    const levels = await getLevels(client, pathwayId);
    
    if (levels.length === 0) {
      console.warn(`No levels found for pathway ${pathwayId}`);
      return null;
    }

    // Get the first level (lowest order_index)
    const firstLevel = levels[0];

    // Get all tasks for the first level, ordered by order_index
    const tasks = await getTasks(client, firstLevel.id);

    if (tasks.length === 0) {
      console.warn(`No tasks found for level ${firstLevel.id}`);
      return null;
    }

    // Get the first task (lowest order_index)
    const firstTask = tasks[0];

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Check if a task instance already exists for today
    const { data: existing } = await client
      .from("user_task_instances")
      .select("id")
      .eq("user_id", userId)
      .eq("pathway_id", pathwayId)
      .eq("task_id", firstTask.id)
      .eq("assigned_for_date", today)
      .single();

    if (existing) {
      // Task already assigned for today, return existing ID
      return existing.id;
    }

    // Create a new task instance for today
    const { data: taskInstance, error } = await client
      .from("user_task_instances")
      .insert({
        user_id: userId,
        pathway_id: pathwayId,
        task_id: firstTask.id,
        assigned_for_date: today,
        status: "assigned",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating task instance:", error);
      throw new Error(`Failed to assign task: ${error.message}`);
    }

    return taskInstance?.id || null;
  } catch (error) {
    console.error("Error in assignFirstTaskToUser:", error);
    throw error;
  }
}
