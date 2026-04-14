"use client";

import { Plus, X } from "lucide-react";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  updateContentField,
  type TaskTypeContentEditorProps,
} from "./utils";

interface HuntItem {
  clue: string;
  item: string;
  location?: string;
  verification?: string;
}

export function ScavengerHuntEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const items = (content.items as HuntItem[]) || [];
  const instructions = (content.instructions as string) || "";
  const theme = (content.theme as string) || "";

  const addItem = () => {
    addArrayItem(
      content,
      "items",
      {
        clue: "",
        item: "",
        location: "",
        verification: "",
      },
      onChange
    );
  };

  const removeItem = (index: number) => {
    removeArrayItem(content, "items", index, onChange);
  };

  const updateItem = (index: number, field: keyof HuntItem, value: string) => {
    const item = items[index] || {};
    updateArrayItem(
      content,
      "items",
      index,
      { ...item, [field]: value },
      onChange
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">Theme</label>
        <input
          type="text"
          value={theme}
          onChange={(e) =>
            updateContentField(content, "theme", e.target.value, onChange)
          }
          placeholder="e.g., industry tools, community resources, learning materials"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Instructions</label>
        <textarea
          value={instructions}
          onChange={(e) =>
            updateContentField(content, "instructions", e.target.value, onChange)
          }
          placeholder="Instructions for the scavenger hunt..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Hunt Items</label>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border-2 border-border bg-muted/30 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex-1 space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    Item {index + 1}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Clue</label>
                    <input
                      type="text"
                      value={item.clue || ""}
                      onChange={(e) => updateItem(index, "clue", e.target.value)}
                      placeholder="Enter clue for this item..."
                      className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Item to Find</label>
                    <input
                      type="text"
                      value={item.item || ""}
                      onChange={(e) => updateItem(index, "item", e.target.value)}
                      placeholder="What should be found?"
                      className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      value={item.location || ""}
                      onChange={(e) => updateItem(index, "location", e.target.value)}
                      placeholder="Where to find it..."
                      className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Verification (optional)
                    </label>
                    <input
                      type="text"
                      value={item.verification || ""}
                      onChange={(e) =>
                        updateItem(index, "verification", e.target.value)
                      }
                      placeholder="How to verify finding the item..."
                      className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-lg border-2 border-border bg-background p-2 text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Add Hunt Item
          </button>
        </div>
      </div>
    </div>
  );
}



