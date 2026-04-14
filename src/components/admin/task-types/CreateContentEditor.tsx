"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function CreateContentEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const content_type = (content.content_type as string) || "";
  const format = (content.format as string) || "";
  const word_count = (content.word_count as number) || 0;
  const guidelines = (content.guidelines as string) || "";
  const examples = (content.examples as string) || "";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Content Type <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={content_type}
          onChange={(e) =>
            updateContentField(content, "content_type", e.target.value, onChange)
          }
          placeholder="e.g., blog post, article, social media post"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Format</label>
        <input
          type="text"
          value={format}
          onChange={(e) =>
            updateContentField(content, "format", e.target.value, onChange)
          }
          placeholder="e.g., markdown, HTML, plain text"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Word Count</label>
        <input
          type="number"
          value={word_count}
          onChange={(e) =>
            updateContentField(
              content,
              "word_count",
              parseInt(e.target.value, 10) || 0,
              onChange
            )
          }
          min="0"
          placeholder="500"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Guidelines</label>
        <textarea
          value={guidelines}
          onChange={(e) =>
            updateContentField(content, "guidelines", e.target.value, onChange)
          }
          placeholder="Content creation guidelines and requirements..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Examples</label>
        <textarea
          value={examples}
          onChange={(e) =>
            updateContentField(content, "examples", e.target.value, onChange)
          }
          placeholder="Example content or references..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



