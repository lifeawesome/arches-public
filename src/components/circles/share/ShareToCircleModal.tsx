"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CircleVisibility, LinkPreviewSnapshot } from "@/types/circles";
import { Check, Loader2 } from "lucide-react";

export type ShareModalSource =
  | { kind: "circle_content"; contentId: string }
  | { kind: "url" };

type Target = { id: string; name: string; slug: string; visibility?: CircleVisibility };

function visibilityLabel(v: CircleVisibility | undefined): string | null {
  if (v === "public") return "Public";
  if (v === "private") return "Private";
  return null;
}

export function ShareToCircleModal({
  open,
  onOpenChange,
  source,
  excludeCircleId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ShareModalSource | null;
  excludeCircleId?: string;
  onSuccess?: () => void;
}) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<LinkPreviewSnapshot | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = targets;
    if (excludeCircleId) {
      list = list.filter((t) => t.id !== excludeCircleId);
    }
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [targets, query, excludeCircleId]);

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    setError(null);
    try {
      const res = await fetch("/api/circles/share-targets");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to load circles");
      }
      const data = (await res.json()) as { targets: Target[] };
      setTargets(data.targets ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadTargets();
    setSelectedId(null);
    setComment("");
    setError(null);
    setPreview(null);
    setPreviewError(null);
    if (source?.kind === "url") {
      setUrlInput("");
    }
  }, [open, loadTargets, source?.kind]);

  const fetchPreview = async () => {
    const u = urlInput.trim();
    if (!u) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview((data.preview ?? {}) as LinkPreviewSnapshot);
    } catch (e) {
      setPreviewError((e as Error).message);
      setPreview({});
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedId || !source) {
      setError("Select a circle");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (source.kind === "circle_content") {
        body = {
          source: { kind: "circle_content", content_id: source.contentId },
          comment: comment.trim() || undefined,
        };
      } else {
        const u = urlInput.trim();
        if (!u) {
          setError("Enter a URL");
          setSubmitting(false);
          return;
        }
        body = {
          source: {
            kind: "url",
            url: u,
            preview: preview && Object.keys(preview).length > 0 ? preview : undefined,
          },
          comment: comment.trim() || undefined,
        };
      }

      const res = await fetch(`/api/circles/${encodeURIComponent(selectedId)}/content/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Share failed");

      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share to Circle</DialogTitle>
          <DialogDescription>
            {source.kind === "circle_content"
              ? "Choose a circle to share this post into."
              : "Paste a link and choose a circle."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {source.kind === "url" && (
            <div className="space-y-2">
              <Label htmlFor="share-url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="share-url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://…"
                  className="flex-1"
                />
                <Button type="button" variant="secondary" onClick={() => void fetchPreview()} disabled={previewLoading}>
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
                </Button>
              </div>
              {previewError && <p className="text-xs text-destructive">{previewError}</p>}
              {preview && (preview.title || preview.description || preview.image) && (
                <div className="rounded-md border border-border p-3 text-sm">
                  {preview.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.image} alt="" className="mb-2 max-h-32 w-full rounded object-cover" />
                  )}
                  {preview.title && <p className="font-medium">{preview.title}</p>}
                  {preview.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{preview.description}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="share-search">Circle</Label>
            <Input
              id="share-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search circles…"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {loadingTargets ? (
                <p className="p-3 text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No circles available.</p>
              ) : (
                <ul className="divide-y divide-border" role="listbox" aria-label="Circles you can share to">
                  {filtered.map((t) => {
                    const vis = visibilityLabel(t.visibility);
                    const selected = selectedId === t.id;
                    return (
                      <li key={t.id} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted ${
                            selected ? "bg-muted" : ""
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30 bg-background"
                            }`}
                            aria-hidden
                          >
                            {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">{t.name}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              {vis ? (
                                <span className="rounded bg-muted/80 px-1.5 py-0 text-[11px] font-medium text-muted-foreground">
                                  {vis}
                                </span>
                              ) : null}
                              <span
                                className="truncate font-mono text-[11px] tracking-tight text-muted-foreground/90"
                                title="Circle handle (for search)"
                              >
                                {t.slug}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-comment">Comment (optional)</Label>
            <textarea
              id="share-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Add context above the shared content…"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !selectedId}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sharing…
              </>
            ) : (
              "Share"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
