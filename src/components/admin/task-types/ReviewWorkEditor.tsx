"use client";

import { Plus, X } from "lucide-react";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  updateContentField,
  type TaskTypeContentEditorProps,
} from "./utils";

export function ReviewWorkEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const criteria = (content.criteria as string[]) || [];
  const instructions = (content.instructions as string) || "";
  const feedback_template = (content.feedback_template as string) || "";

  const addCriterion = () => {
    addArrayItem(content, "criteria", "", onChange);
  };

  const removeCriterion = (index: number) => {
    removeArrayItem(content, "criteria", index, onChange);
  };

  const updateCriterion = (index: number, value: string) => {
    updateArrayItem(content, "criteria", index, value, onChange);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">Review Criteria</label>
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={criterion}
                onChange={(e) => updateCriterion(index, e.target.value)}
                placeholder="Enter review criterion..."
                className="flex-1 rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeCriterion(index)}
                className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCriterion}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Add Criterion
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
          placeholder="Instructions for reviewing work..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Feedback Template</label>
        <textarea
          value={feedback_template}
          onChange={(e) =>
            updateContentField(content, "feedback_template", e.target.value, onChange)
          }
          placeholder="Template for providing feedback..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



