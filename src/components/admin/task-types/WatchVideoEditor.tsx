"use client";

import { updateContentField, type TaskTypeContentEditorProps } from "./utils";

export function WatchVideoEditor({
  content,
  schema,
  onChange,
}: TaskTypeContentEditorProps) {
  const video_url = (content.video_url as string) || "";
  const video_duration = (content.video_duration as number) || 0;
  const transcript = (content.transcript as string) || "";
  const notes = (content.notes as string) || "";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium">
          Video URL <span className="text-destructive">*</span>
        </label>
        <input
          type="url"
          value={video_url}
          onChange={(e) =>
            updateContentField(content, "video_url", e.target.value, onChange)
          }
          placeholder="https://youtube.com/watch?v=..."
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Video Duration (minutes)</label>
        <input
          type="number"
          value={video_duration}
          onChange={(e) =>
            updateContentField(
              content,
              "video_duration",
              parseInt(e.target.value, 10) || 0,
              onChange
            )
          }
          min="0"
          placeholder="15"
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Transcript</label>
        <textarea
          value={transcript}
          onChange={(e) =>
            updateContentField(content, "transcript", e.target.value, onChange)
          }
          placeholder="Optional video transcript..."
          rows={4}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) =>
            updateContentField(content, "notes", e.target.value, onChange)
          }
          placeholder="Additional notes or key points..."
          rows={3}
          className="w-full rounded-lg border-2 border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>
    </div>
  );
}



