"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function PracticeSkillEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const skill = (content.skill as string) || "";
  const duration = (content.duration as number) || 0;
  const method = (content.method as string) || "";
  const resources = (content.resources as string) || "";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Skill <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={skill}
          onChange={(e) =>
            updateContentField(content, "skill", e.target.value, onChange)
          }
          placeholder="e.g., public speaking, writing, coding"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Duration (minutes)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) =>
            updateContentField(
              content,
              "duration",
              parseInt(e.target.value, 10) || 0,
              onChange
            )
          }
          min="0"
          placeholder="30"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Practice Method</label>
        <textarea
          value={method}
          onChange={(e) =>
            updateContentField(content, "method", e.target.value, onChange)
          }
          placeholder="How to practice this skill..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Resources</label>
        <textarea
          value={resources}
          onChange={(e) =>
            updateContentField(content, "resources", e.target.value, onChange)
          }
          placeholder="Helpful resources for practicing this skill..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



