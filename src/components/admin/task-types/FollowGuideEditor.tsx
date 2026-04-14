"use client";

import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  moveArrayItem,
  updateContentField,
  type TaskTypeContentEditorProps,
} from "./utils";

interface Step {
  title: string;
  description: string;
  resources: string[];
}

export function FollowGuideEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const steps = (content.steps as Step[]) || [];
  const guide_title = (content.guide_title as string) || "";
  const overview = (content.overview as string) || "";

  const addStep = () => {
    addArrayItem(
      content,
      "steps",
      {
        title: "",
        description: "",
        resources: [],
      },
      onChange
    );
  };

  const removeStep = (index: number) => {
    removeArrayItem(content, "steps", index, onChange);
  };

  const updateStep = (index: number, field: keyof Step, value: unknown) => {
    const step = steps[index] || {};
    updateArrayItem(
      content,
      "steps",
      index,
      { ...step, [field]: value },
      onChange
    );
  };

  const addResource = (stepIndex: number) => {
    const step = steps[stepIndex] || { resources: [] };
    const resources = step.resources || [];
    updateStep(stepIndex, "resources", [...resources, ""]);
  };

  const removeResource = (stepIndex: number, resourceIndex: number) => {
    const step = steps[stepIndex] || { resources: [] };
    const resources = step.resources || [];
    updateStep(
      stepIndex,
      "resources",
      resources.filter((_, i) => i !== resourceIndex)
    );
  };

  const updateResource = (stepIndex: number, resourceIndex: number, value: string) => {
    const step = steps[stepIndex] || { resources: [] };
    const resources = step.resources || [];
    const updatedResources = [...resources];
    updatedResources[resourceIndex] = value;
    updateStep(stepIndex, "resources", updatedResources);
  };

  const moveStep = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex >= 0 && toIndex < steps.length) {
      moveArrayItem(content, "steps", fromIndex, toIndex, onChange);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">Guide Title</label>
        <input
          type="text"
          value={guide_title}
          onChange={(e) =>
            updateContentField(content, "guide_title", e.target.value, onChange)
          }
          placeholder="Enter guide title..."
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Overview</label>
        <textarea
          value={overview}
          onChange={(e) =>
            updateContentField(content, "overview", e.target.value, onChange)
          }
          placeholder="Guide overview..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Steps</label>
        <div className="space-y-4">
          {steps.map((step, sIndex) => (
            <div
              key={sIndex}
              className="rounded-lg border-2 border-border bg-muted/30 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Step {sIndex + 1}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(sIndex, "up")}
                        disabled={sIndex === 0}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-background disabled:opacity-50"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(sIndex, "down")}
                        disabled={sIndex === steps.length - 1}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-background disabled:opacity-50"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={step.title || ""}
                    onChange={(e) => updateStep(sIndex, "title", e.target.value)}
                    placeholder="Step title..."
                    className="mb-2 w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <textarea
                    value={step.description || ""}
                    onChange={(e) => updateStep(sIndex, "description", e.target.value)}
                    placeholder="Step description..."
                    rows={3}
                    className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(sIndex)}
                  className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Resources (URLs)</label>
                {(step.resources || []).map((resource, rIndex) => (
                  <div key={rIndex} className="flex gap-2">
                    <input
                      type="url"
                      value={resource}
                      onChange={(e) => updateResource(sIndex, rIndex, e.target.value)}
                      placeholder="https://example.com/resource"
                      className="flex-1 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeResource(sIndex, rIndex)}
                      className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addResource(sIndex)}
                  className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  Add Resource
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Add Step
          </button>
        </div>
      </div>
    </div>
  );
}



