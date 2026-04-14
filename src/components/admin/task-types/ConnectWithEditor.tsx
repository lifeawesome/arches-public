"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function ConnectWithEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const connection_type = (content.connection_type as string) || "";
  const platform = (content.platform as string) || "";
  const instructions = (content.instructions as string) || "";
  const tips = (content.tips as string) || "";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Connection Type <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={connection_type}
          onChange={(e) =>
            updateContentField(content, "connection_type", e.target.value, onChange)
          }
          placeholder="e.g., industry expert, mentor, peer, community member"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Platform</label>
        <input
          type="text"
          value={platform}
          onChange={(e) =>
            updateContentField(content, "platform", e.target.value, onChange)
          }
          placeholder="e.g., LinkedIn, Twitter, Discord, email"
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
          placeholder="Instructions for making the connection..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Tips</label>
        <textarea
          value={tips}
          onChange={(e) =>
            updateContentField(content, "tips", e.target.value, onChange)
          }
          placeholder="Tips for successful connection..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



