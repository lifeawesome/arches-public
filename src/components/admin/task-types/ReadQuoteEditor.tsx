"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function ReadQuoteEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const quote = (content.quote as string) || "";
  const author = (content.author as string) || "";
  const source = (content.source as string) || "";
  const context = (content.context as string) || "";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Quote <span className="text-destructive">*</span>
        </label>
        <textarea
          value={quote}
          onChange={(e) => updateContentField(content, "quote", e.target.value, onChange)}
          placeholder="Enter the quote text..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Author</label>
        <input
          type="text"
          value={author}
          onChange={(e) =>
            updateContentField(content, "author", e.target.value, onChange)
          }
          placeholder="Author name"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Source</label>
        <input
          type="text"
          value={source}
          onChange={(e) =>
            updateContentField(content, "source", e.target.value, onChange)
          }
          placeholder="Book, article, or publication"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Context</label>
        <textarea
          value={context}
          onChange={(e) =>
            updateContentField(content, "context", e.target.value, onChange)
          }
          placeholder="Additional context or explanation..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



