"use client";

import { useMemo, useRef, useState, useCallback, type ChangeEvent, type KeyboardEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { Markdown } from "@/components/common/Markdown";
import { CircleHelp, Eye, EyeOff, ImagePlus, Loader2 } from "lucide-react";

type MentionSuggestion = {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

type CircleMarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  previewClassName?: string;
  uploadBucket?: string;
  /** When set, enables @ member autocomplete for circle posts/comments. */
  circleId?: string;
};

type ToolbarAction = {
  label: string;
  title: string;
  prefix: string;
  suffix?: string;
  multiline?: boolean;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "H2", title: "Heading", prefix: "## " },
  { label: "B", title: "Bold", prefix: "**", suffix: "**" },
  { label: "I", title: "Italic", prefix: "_", suffix: "_" },
  { label: "List", title: "Bullet list", prefix: "- ", multiline: true },
  { label: "Link", title: "Insert link", prefix: "[text](", suffix: "https://example.com)" },
  { label: "Code", title: "Code block", prefix: "```ts\n", suffix: "\n```" },
  { label: "Quote", title: "Quote", prefix: "> ", multiline: true },
  { label: "Table", title: "Table", prefix: "\n| Col 1 | Col 2 |\n| --- | --- |\n| A | B |\n" },
];

function applyMarkdownWrap(input: string, selectionStart: number, selectionEnd: number, action: ToolbarAction) {
  const selected = input.slice(selectionStart, selectionEnd);
  if (action.multiline && selected) {
    const transformed = selected
      .split("\n")
      .map((line) => (line.trim() ? `${action.prefix}${line}` : line))
      .join("\n");
    const nextValue = `${input.slice(0, selectionStart)}${transformed}${input.slice(selectionEnd)}`;
    return { nextValue, cursorStart: selectionStart, cursorEnd: selectionStart + transformed.length };
  }

  const wrapped = `${action.prefix}${selected}${action.suffix ?? ""}`;
  const nextValue = `${input.slice(0, selectionStart)}${wrapped}${input.slice(selectionEnd)}`;
  return { nextValue, cursorStart: selectionStart, cursorEnd: selectionStart + wrapped.length };
}

export function CircleMarkdownEditor({
  value,
  onChange,
  placeholder = "Write in Markdown…",
  rows = 6,
  previewClassName,
  uploadBucket = process.env.NEXT_PUBLIC_CIRCLE_MARKDOWN_IMAGES_BUCKET || "pathway-images",
  circleId,
}: CircleMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionEnd, setMentionEnd] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSuggestions = useCallback(
    async (q: string) => {
      if (!circleId) return;
      setMentionLoading(true);
      try {
        const res = await fetch(
          `/api/circles/${encodeURIComponent(circleId)}/mentions/suggest?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: MentionSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setHighlightIdx(0);
      } catch {
        setSuggestions([]);
      } finally {
        setMentionLoading(false);
      }
    },
    [circleId]
  );

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionStart(null);
    setMentionEnd(null);
    setSuggestions([]);
  }, []);

  const applyMention = useCallback(
    (username: string) => {
      if (mentionStart === null || mentionEnd === null) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(mentionEnd);
      const insert = `@${username} `;
      const next = `${before}${insert}${after}`;
      onChange(next);
      closeMention();
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = before.length + insert.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    },
    [value, onChange, mentionStart, mentionEnd, closeMention]
  );

  const onTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    onChange(next);
    const pos = event.target.selectionStart ?? next.length;
    const before = next.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at === -1 || !circleId) {
      closeMention();
      return;
    }
    const slice = before.slice(at + 1);
    if (/[\s\n]/.test(slice)) {
      closeMention();
      return;
    }
    setMentionOpen(true);
    setMentionStart(at);
    setMentionEnd(pos);
    if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    mentionDebounce.current = setTimeout(() => {
      void loadSuggestions(slice);
    }, 200);
  };

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIdx((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && mentionOpen) {
      event.preventDefault();
      const s = suggestions[highlightIdx];
      if (s) applyMention(s.username);
    } else if (event.key === "Escape") {
      closeMention();
    }
  };

  const insertAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const { nextValue, cursorStart, cursorEnd } = applyMarkdownWrap(value, start, end, action);
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be 10MB or smaller.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to upload images.");
      }

      const ext = file.name.split(".").pop() || "png";
      const path = `circles/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error } = await supabase.storage.from(uploadBucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from(uploadBucket).getPublicUrl(data.path);
      const snippet = `![${file.name}](${publicUrl})`;
      onChange(value.trim() ? `${value}\n\n${snippet}` : snippet);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => insertAction(action)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
            title={action.title}
            disabled={previewMode}
          >
            {action.label}
          </button>
        ))}
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          Image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={uploading || previewMode}
          />
        </label>
        <button
          type="button"
          onClick={() => setPreviewMode((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
        >
          {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {previewMode ? "Edit" : "Preview"}
        </button>
        <details className="text-xs text-muted-foreground">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1">
            <CircleHelp className="h-3.5 w-3.5" /> Markdown help
          </summary>
          <p className="mt-1">
            Use `#` headings, lists, links, `![alt](url)` images, fenced code blocks and GFM tables.
            {circleId ? " Mention circle members with @username (set a username in Settings)." : ""}
          </p>
        </details>
      </div>

      {previewMode ? (
        <div className={previewClassName ?? "prose prose-sm max-w-none rounded-md border border-input p-3 dark:prose-invert"}>
          <Markdown>{value || "_Nothing to preview yet._"}</Markdown>
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={onTextareaChange}
            onKeyDown={onTextareaKeyDown}
            placeholder={placeholder}
            rows={rows}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {mentionOpen && circleId && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
              {mentionLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No members with a username. Set one in Dashboard → Settings.
                </div>
              ) : (
                suggestions.map((s, idx) => (
                  <button
                    key={s.user_id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyMention(s.username)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                      idx === highlightIdx ? "bg-accent" : ""
                    }`}
                  >
                    <span className="font-medium">@{s.username}</span>
                    <span className="truncate text-muted-foreground">{s.full_name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
    </div>
  );
}
