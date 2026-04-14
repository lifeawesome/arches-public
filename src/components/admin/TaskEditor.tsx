"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { TaskTypeContentEditor } from "./task-types/TaskTypeContentEditor";
import { TaskTypeSelector } from "./TaskTypeSelector";
import { TASK_TYPE_SLUGS, type TaskTypeSlug } from "@/lib/admin/level-task-queries";

interface TaskEditorProps {
  levelId: string;
  task?: {
    id: string;
    title: string;
    task_type: string;
    task_type_id?: string;
    objective: string;
    time_min: number;
    time_max: number;
    why_it_matters?: string | null;
    instructions?: string | null;
    xp_value: number;
    is_keystone: boolean;
    content?: Record<string, unknown>;
  } | null;
  onSave: (taskData: {
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
  }) => Promise<void>;
  onCancel: () => void;
}

export default function TaskEditor({
  levelId,
  task,
  onSave,
  onCancel,
}: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title || "");
  const [taskTypeSlug, setTaskTypeSlug] = useState<TaskTypeSlug>(
    (task?.task_type_id as TaskTypeSlug) || "read-text"
  );
  const [objective, setObjective] = useState(task?.objective || "");
  const [timeMin, setTimeMin] = useState(task?.time_min?.toString() || "15");
  const [timeMax, setTimeMax] = useState(task?.time_max?.toString() || "30");
  const [whyItMatters, setWhyItMatters] = useState(task?.why_it_matters || "");
  const [instructions, setInstructions] = useState(task?.instructions || "");
  const [xpValue, setXpValue] = useState(task?.xp_value?.toString() || "25");
  const [isKeystone, setIsKeystone] = useState(task?.is_keystone || false);
  const [content, setContent] = useState<Record<string, unknown>>(
    task?.content || {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize content when task is loaded, reset when task type changes
  useEffect(() => {
    if (task && task.task_type_id === taskTypeSlug) {
      // Task is loaded and task type matches - initialize content from task
      setContent(task.content || {});
    } else if (!task || task.task_type_id !== taskTypeSlug) {
      // No task or task type changed - reset content
      setContent({});
    }
  }, [taskTypeSlug, task]);

  const taskTypeDisplayNames: Record<TaskTypeSlug, string> = {
    "read-text": "Read Text",
    "watch-video": "Watch Video",
    "take-quiz": "Take Quiz",
    "follow-guide": "Follow Guide",
    "scavenger-hunt": "Scavenger Hunt",
    "read-quote": "Read Quote",
    "create-content": "Create Content",
    "refine-content": "Refine Content",
    "publish-content": "Publish Content",
    "practice-skill": "Practice Skill",
    "review-work": "Review Work",
    "connect-with": "Connect With",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !objective.trim()) {
      setError("Title and objective are required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        task_type_id: taskTypeSlug,
        objective: objective.trim(),
        time_min: parseInt(timeMin, 10) || 15,
        time_max: parseInt(timeMax, 10) || 30,
        why_it_matters: whyItMatters.trim() || undefined,
        instructions: instructions.trim() || undefined,
        xp_value: parseInt(xpValue, 10) || 25,
        is_keystone: isKeystone,
        content: content, // Always pass content, even if empty
      });
    } catch (err) {
      console.error("Error saving task:", err);
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border-2 border-border bg-background shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <h2 className="text-xl font-semibold">
            {task ? "Edit Task" : "Create Task"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
            disabled={isSaving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              required
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Task Type <span className="text-destructive">*</span>
            </label>
            <TaskTypeSelector
              selectedSlug={taskTypeSlug}
              onSelect={setTaskTypeSlug}
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Objective <span className="text-destructive">*</span>
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What should the user accomplish with this task?"
              rows={3}
              className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              required
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Time Min (minutes)
              </label>
              <input
                type="number"
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value)}
                min="0"
                placeholder="15"
                className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">
                Time Max (minutes)
              </label>
              <input
                type="number"
                value={timeMax}
                onChange={(e) => setTimeMax(e.target.value)}
                min="0"
                placeholder="30"
                className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                disabled={isSaving}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Why It Matters
            </label>
            <textarea
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              placeholder="Why is this task important?"
              rows={2}
              className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Additional instructions for completing this task..."
              rows={3}
              className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">XP Value</label>
              <input
                type="number"
                value={xpValue}
                onChange={(e) => setXpValue(e.target.value)}
                min="0"
                placeholder="25"
                className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center gap-2 pt-8">
              <input
                type="checkbox"
                id="is_keystone"
                checked={isKeystone}
                onChange={(e) => setIsKeystone(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                disabled={isSaving}
              />
              <label htmlFor="is_keystone" className="text-sm font-medium">
                Keystone Task
              </label>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Task Type Content
            </label>
            <div className="rounded-lg border-2 border-border bg-muted/30 p-4">
              <TaskTypeContentEditor
                taskTypeSlug={taskTypeSlug}
                content={content}
                schema={{}}
                onChange={setContent}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 border-t border-border pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-lg border-2 border-border bg-background px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

