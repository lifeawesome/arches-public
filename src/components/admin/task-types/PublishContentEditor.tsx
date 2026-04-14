"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function PublishContentEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const platform = (content.platform as string) || "";
  const platform_url = (content.platform_url as string) || "";
  const requirements = (content.requirements as string) || "";
  const checklist = (content.checklist as string) || "";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Platform <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={platform}
          onChange={(e) =>
            updateContentField(content, "platform", e.target.value, onChange)
          }
          placeholder="e.g., Medium, LinkedIn, Twitter, Personal Blog"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Platform URL</label>
        <input
          type="url"
          value={platform_url}
          onChange={(e) =>
            updateContentField(content, "platform_url", e.target.value, onChange)
          }
          placeholder="https://example.com"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Requirements</label>
        <textarea
          value={requirements}
          onChange={(e) =>
            updateContentField(content, "requirements", e.target.value, onChange)
          }
          placeholder="Platform-specific requirements and guidelines..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Checklist</label>
        <textarea
          value={checklist}
          onChange={(e) =>
            updateContentField(content, "checklist", e.target.value, onChange)
          }
          placeholder="Pre-publishing checklist items..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



