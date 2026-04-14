"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { createClient } from "@/utils/supabase/client";
import { Save, Loader2, Plus } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import LevelEditor from "@/components/admin/LevelEditor";
import TaskEditor from "@/components/admin/TaskEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/Toasts/use-toast";
import {
  getLevels,
  getTasks,
  getTask,
  createLevel,
  updateLevel,
  deleteLevel,
  createTask,
  updateTask,
  deleteTask,
  type Level,
  type Task,
  type TaskType,
} from "@/lib/admin/level-task-queries";

export default function EditPathwayPage() {
  const router = useRouter();
  const params = useParams();
  const pathwayId = params.id as string;
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    summary: "",
    difficulty: 3,
    estimated_days: 30,
    cover_image_url: "",
    outcomes: [] as string[],
    is_active: false,
    version: 1,
  });
  const [newOutcome, setNewOutcome] = useState("");
  const [levels, setLevels] = useState<
    (Level & { tasks: (Task & { task_type: TaskType | null })[] })[]
  >([]);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<{
    task?: Task & { task_type?: TaskType | null };
    levelId: string;
  } | null>(null);
  const [isLoadingLevels, setIsLoadingLevels] = useState(false);
  const { toast } = useToast();
  const [deleteLevelDialog, setDeleteLevelDialog] = useState<{
    open: boolean;
    levelId: string | null;
  }>({ open: false, levelId: null });
  const [deleteTaskDialog, setDeleteTaskDialog] = useState<{
    open: boolean;
    taskId: string | null;
  }>({ open: false, taskId: null });



  type LevelsWithTasks = Level & { tasks: (Task & { task_type: TaskType | null })[] };

  useEffect(() => {
    const fetchPathway = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("pathways")
          .select("*")
          .eq("id", pathwayId)
          .single();

        if (fetchError) {
          setError("Failed to load pathway: " + fetchError.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setError("Pathway not found");
          setIsLoading(false);
          return;
        }

        setFormData({
          title: data.title || "",
          slug: data.slug || "",
          summary: data.summary || "",
          difficulty: data.difficulty || 3,
          estimated_days: data.estimated_days || null,
          cover_image_url: data.cover_image_url || "",
          outcomes: Array.isArray(data.outcomes) ? data.outcomes : [],
          is_active: data.is_active ?? false,
          version: data.version || 1,
        });
      } catch (err) {
        console.error("Error fetching pathway:", err);
        setError("Failed to load pathway");
      } finally {
        setIsLoading(false);
      }
    };

    if (pathwayId) {
      fetchPathway();
      fetchLevelsAndTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathwayId, supabase]);

  const fetchLevelsAndTasks = async () => {
    setIsLoadingLevels(true);
    try {
      const pathwayLevels = await getLevels(supabase, pathwayId);
      const levelsWithTasks = await Promise.all(
        pathwayLevels.map(async (level) => {
          const tasks = await getTasks(supabase, level.id);
          return { ...level, tasks };
        })
      );
      setLevels(levelsWithTasks as LevelsWithTasks[]);
      // Expand all levels by default
      setExpandedLevels(new Set(levelsWithTasks.map((l) => l.id)));
    } catch (error) {
      console.error("Error fetching levels:", error);
    } finally {
      setIsLoadingLevels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // Generate slug from title if not provided
      const slug =
        formData.slug ||
        formData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const { error: updateError } = await supabase
        .from("pathways")
        .update({
          title: formData.title,
          slug: slug,
          summary: formData.summary || null,
          difficulty: formData.difficulty,
          estimated_days: formData.estimated_days || null,
          cover_image_url: formData.cover_image_url || null,
          outcomes: formData.outcomes,
          is_active: formData.is_active,
          version: formData.version,
        })
        .eq("id", pathwayId);

      if (updateError) {
        setError("Failed to update pathway: " + updateError.message);
        setIsSaving(false);
        return;
      }

      // Redirect back to pathways list
      router.push("/admin/pathways");
    } catch (err) {
      console.error("Error updating pathway:", err);
      setError("Failed to update pathway");
      setIsSaving(false);
    }
  };

  const addOutcome = () => {
    if (newOutcome.trim()) {
      setFormData({
        ...formData,
        outcomes: [...formData.outcomes, newOutcome.trim()],
      });
      setNewOutcome("");
    }
  };

  const removeOutcome = (index: number) => {
    setFormData({
      ...formData,
      outcomes: formData.outcomes.filter((_, i) => i !== index),
    });
  };

  // Level management handlers
  const handleAddLevel = async () => {
    const title = prompt("Enter level title:");
    if (!title) return;

    try {
      await createLevel(supabase, pathwayId, { title });
      await fetchLevelsAndTasks();
      toast({
        title: "Level created",
        description: `Level "${title}" has been created successfully.`,
      });
    } catch (error) {
      console.error("Error creating level:", error);
      toast({
        title: "Failed to create level",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLevel = async (
    levelId: string,
    updates: Partial<Level>
  ) => {
    try {
      await updateLevel(supabase, levelId, updates);
      await fetchLevelsAndTasks();
    } catch (error) {
      console.error("Error updating level:", error);
      toast({
        title: "Failed to update level",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLevelClick = (levelId: string) => {
    setDeleteLevelDialog({ open: true, levelId });
  };

  const handleDeleteLevelConfirm = async () => {
    if (!deleteLevelDialog.levelId) return;

    try {
      await deleteLevel(supabase, deleteLevelDialog.levelId);
      await fetchLevelsAndTasks();
      toast({
        title: "Level deleted",
        description: "The level and all its tasks have been deleted.",
      });
    } catch (error) {
      console.error("Error deleting level:", error);
      toast({
        title: "Failed to delete level",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteLevelDialog({ open: false, levelId: null });
    }
  };

  const handleToggleLevel = (levelId: string) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(levelId)) {
      newExpanded.delete(levelId);
    } else {
      newExpanded.add(levelId);
    }
    setExpandedLevels(newExpanded);
  };

  // Task management handlers
  const handleAddTask = (levelId: string) => {
    setEditingTask({ levelId });
  };

  const handleEditTask = async (taskId: string) => {
    const task = await getTask(supabase, taskId);
    if (task) {
      setEditingTask({ task: task as Task & { task_type?: TaskType | null }, levelId: task.level_id });
    }
  };

  const handleSaveTask = async (taskData: {
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
  }) => {
    if (!editingTask) return;

    try {
      if (editingTask.task) {
        await updateTask(supabase, editingTask.task.id, taskData);
        toast({
          title: "Task updated",
          description: `Task "${taskData.title}" has been updated successfully.`,
        });
      } else {
        await createTask(supabase, editingTask.levelId, taskData);
        toast({
          title: "Task created",
          description: `Task "${taskData.title}" has been created successfully.`,
        });
      }
      setEditingTask(null);
      await fetchLevelsAndTasks();
    } catch (error) {
      console.error("Error saving task:", error);
      toast({
        title: "Failed to save task",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteTaskClick = (taskId: string) => {
    setDeleteTaskDialog({ open: true, taskId });
  };

  const handleDeleteTaskConfirm = async () => {
    if (!deleteTaskDialog.taskId) return;

    try {
      await deleteTask(supabase, deleteTaskDialog.taskId);
      await fetchLevelsAndTasks();
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Failed to delete task",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteTaskDialog({ open: false, taskId: null });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8 flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading pathway...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !formData.title) {
    return (
      <AdminLayout>
        <div className="p-8 max-w-4xl">
          <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-6">
            <p className="text-destructive font-semibold mb-4">{error}</p>
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

  return (
    <AdminLayout>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Edit Pathway</h1>
          <p className="text-muted-foreground">
            Update pathway details and settings
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border-2 border-border bg-background p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Basic Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium mb-2"
                  >
                    Pathway Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Personal Branding"
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="slug"
                    className="block text-sm font-medium mb-2"
                  >
                    URL Slug (auto-generated if empty)
                  </label>
                  <input
                    id="slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                    placeholder="personal-branding"
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="summary"
                    className="block text-sm font-medium mb-2"
                  >
                    Summary
                  </label>
                  <textarea
                    id="summary"
                    value={formData.summary}
                    onChange={(e) =>
                      setFormData({ ...formData, summary: e.target.value })
                    }
                    placeholder="A brief description of what experts will learn..."
                    rows={3}
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="difficulty"
                    className="block text-sm font-medium mb-2"
                  >
                    Difficulty (1-5)
                  </label>
                  <input
                    id="difficulty"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        difficulty: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="estimated_days"
                    className="block text-sm font-medium mb-2"
                  >
                    Estimated Days
                  </label>
                  <input
                    id="estimated_days"
                    type="number"
                    min="1"
                    value={formData.estimated_days || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_days: e.target.value
                          ? parseInt(e.target.value)
                          : 0,
                      })
                    }
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="version"
                    className="block text-sm font-medium mb-2"
                  >
                    Version
                  </label>
                  <input
                    id="version"
                    type="number"
                    min="1"
                    value={formData.version}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        version: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">
                      Active (visible to users)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Outcomes */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Learning Outcomes
              </h2>
              <div className="space-y-3">
                {formData.outcomes.map((outcome, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border-2 border-border bg-muted/30 p-3"
                  >
                    <span className="flex-1 text-sm">{outcome}</span>
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOutcome();
                      }
                    }}
                    placeholder="Add a learning outcome..."
                    className="flex-1 rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={addOutcome}
                    className="rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Cover Image (optional)
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Upload a cover image for this pathway, or enter a URL manually
              </p>
              <ImageUpload
                bucket="pathway-images"
                currentImageUrl={formData.cover_image_url || undefined}
                onImageUploaded={(url) =>
                  setFormData({ ...formData, cover_image_url: url })
                }
                onImageRemoved={() =>
                  setFormData({ ...formData, cover_image_url: "" })
                }
                maxSizeMB={10}
              />
              <div className="mt-3">
                <label
                  htmlFor="cover_image_url_manual"
                  className="block text-xs text-muted-foreground mb-2"
                >
                  Or enter URL manually:
                </label>
                <input
                  id="cover_image_url_manual"
                  type="url"
                  value={formData.cover_image_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cover_image_url: e.target.value,
                    })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg border-2 border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Levels Section */}
          <div className="rounded-lg border-2 border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Levels & Tasks</h2>
                <p className="text-sm text-muted-foreground">
                  Manage the levels (modules) and tasks within this pathway
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddLevel}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Level
              </button>
            </div>

            {isLoadingLevels ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading levels...
              </div>
            ) : levels.length === 0 ? (
              <div className="rounded border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No levels yet. Add your first level to start building this
                  pathway.
                </p>
                <button
                  type="button"
                  onClick={handleAddLevel}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Add First Level
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {levels.map((level) => (
                  <LevelEditor
                    key={level.id}
                    level={level}
                    tasks={level.tasks}
                    onUpdate={(updates) =>
                      handleUpdateLevel(level.id, updates)
                    }
                    onDelete={() => handleDeleteLevelClick(level.id)}
                    onAddTask={() => handleAddTask(level.id)}
                    onEditTask={handleEditTask}
                    onDeleteTask={handleDeleteTaskClick}
                    isExpanded={expandedLevels.has(level.id)}
                    onToggleExpand={() => handleToggleLevel(level.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link
              href="/admin/pathways"
              className="rounded-lg border-2 border-border bg-background px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving || !formData.title}
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
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>

        {/* Task Editor Modal */}
        {editingTask && (
          <TaskEditor
            levelId={editingTask.levelId}
            task={editingTask.task}
            onSave={handleSaveTask}
            onCancel={() => setEditingTask(null)}
          />
        )}
      </div>

      {/* Delete Level Dialog */}
      <AlertDialog
        open={deleteLevelDialog.open}
        onOpenChange={(open) =>
          setDeleteLevelDialog({ open, levelId: deleteLevelDialog.levelId })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Level</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this level and all its tasks? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLevelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Dialog */}
      <AlertDialog
        open={deleteTaskDialog.open}
        onOpenChange={(open) =>
          setDeleteTaskDialog({ open, taskId: deleteTaskDialog.taskId })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTaskConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
