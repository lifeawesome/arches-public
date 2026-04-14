"use client";

import { Plus, X } from "lucide-react";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  updateContentField,
  type TaskTypeContentEditorProps,
} from "./utils";

export function RefineContentEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const improvement_areas = (content.improvement_areas as string[]) || [];
  const instructions = (content.instructions as string) || "";
  const criteria = (content.criteria as string) || "";

  const addImprovementArea = () => {
    addArrayItem(content, "improvement_areas", "", onChange);
  };

  const removeImprovementArea = (index: number) => {
    removeArrayItem(content, "improvement_areas", index, onChange);
  };

  const updateImprovementArea = (index: number, value: string) => {
    updateArrayItem(content, "improvement_areas", index, value, onChange);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Improvement Areas</label>
        <div className="space-y-2">
          {improvement_areas.map((area, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={area}
                onChange={(e) => updateImprovementArea(index, e.target.value)}
                placeholder="Enter improvement area..."
                className="flex-1 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeImprovementArea(index)}
                className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addImprovementArea}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Add Improvement Area
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Instructions</label>
        <textarea
          value={instructions}
          onChange={(e) =>
            updateContentField(content, "instructions", e.target.value, onChange)
          }
          placeholder="Instructions for refining content..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Refinement Criteria</label>
        <textarea
          value={criteria}
          onChange={(e) =>
            updateContentField(content, "criteria", e.target.value, onChange)
          }
          placeholder="Criteria for evaluating refined content..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



