"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function ReadTextEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const text = (content.text as string) || "";
  const article_url = (content.article_url as string) || "";
  const reading_time = (content.reading_time as number) || 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Text Content <span className="text-destructive">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => updateContentField(content, "text", e.target.value, onChange)}
          placeholder="Enter the text content for this reading task..."
          rows={6}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Article URL</label>
        <input
          type="url"
          value={article_url}
          onChange={(e) =>
            updateContentField(content, "article_url", e.target.value, onChange)
          }
          placeholder="https://example.com/article"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Reading Time (minutes)</label>
        <input
          type="number"
          value={reading_time}
          onChange={(e) =>
            updateContentField(
              content,
              "reading_time",
              parseInt(e.target.value, 10) || 0,
              onChange
            )
          }
          min="0"
          placeholder="10"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



