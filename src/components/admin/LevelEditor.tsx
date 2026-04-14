"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Edit2, Trash2, Plus, X, Save, Loader2 } from "lucide-react";
import type { Level, Task, TaskType } from "@/lib/admin/level-task-queries";

interface LevelEditorProps {
  level: Level;
  tasks: (Task & { task_type?: TaskType | null })[];
  onUpdate: (updates: Partial<Level>) => void;
  onDelete: () => void;
  onAddTask: () => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function LevelEditor({
  level,
  tasks,
  onUpdate,
  onDelete,
  onAddTask,
  onEditTask,
  onDeleteTask,
  isExpanded,
  onToggleExpand,
}: LevelEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(level.title);
  const [summary, setSummary] = useState(level.summary || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
        title: title.trim(),
        summary: summary.trim() || null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating level:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(level.title);
    setSummary(level.summary || "");
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete();
  };

  return (
    <div className="rounded-lg border-2 border-border bg-background">
      {/* Level Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1">
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </button>

          {isEditing ? (
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Level title..."
                className="w-full rounded-lg border-2 border-border bg-background px-3 py-1.5 text-sm font-semibold focus:border-primary focus:outline-none"
                disabled={isSaving}
              />
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Level summary (optional)..."
                rows={2}
                className="w-full rounded-lg border-2 border-border bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
                disabled={isSaving}
              />
            </div>
          ) : (
            <div className="flex-1">
              <h3 className="font-semibold text-base">{level.title}</h3>
              {level.summary && (
                <p className="text-sm text-muted-foreground mt-1">{level.summary}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !title.trim()}
                className="rounded-lg border-2 border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-lg border-2 border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-lg border-2 border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Tasks List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Tasks</h4>
              <button
                type="button"
                onClick={onAddTask}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  No tasks yet. Add your first task to this level.
                </p>
                <button
                  type="button"
                  onClick={onAddTask}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border-2 border-border bg-muted/30 p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium text-sm">{task.title}</h5>
                        {task.is_keystone && (
                          <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                            Keystone
                          </span>
                        )}
                        {task.task_type && (
                          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {task.task_type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.objective}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>
                          {task.time_min}-{task.time_max} min
                        </span>
                        <span>•</span>
                        <span>{task.xp_value} XP</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditTask(task.id)}
                        className="rounded-lg border-2 border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



