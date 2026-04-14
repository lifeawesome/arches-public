import type { SupabaseClient } from "@supabase/supabase-js";

type LifecycleAction = "circle_archived" | "circle_unarchived" | "circle_deleted";

export async function insertCircleLifecycleAudit(
  supabase: SupabaseClient,
  circleId: string,
  actorId: string,
  action: LifecycleAction,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("circle_moderation_activity_log").insert({
    circle_id: circleId,
    actor_id: actorId,
    action,
    target_type: "circle",
    target_id: circleId,
    metadata: metadata ?? {},
  });
  if (error) {
    console.error("insertCircleLifecycleAudit:", error.message);
  }
}
