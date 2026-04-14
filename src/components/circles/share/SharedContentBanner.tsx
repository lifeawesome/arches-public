"use client";

import Link from "next/link";
import { ExternalLink, Share2 } from "lucide-react";
import type { SharedFromPayload } from "@/types/circles";

function parseSharedFrom(raw: unknown): SharedFromPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { kind?: string };
  if (o.kind === "circle_content" || o.kind === "url") {
    return raw as SharedFromPayload;
  }
  return null;
}

export function SharedContentBanner({
  sharedFrom,
  sharerName,
}: {
  sharedFrom: unknown;
  sharerName?: string;
}) {
  const sf = parseSharedFrom(sharedFrom);
  if (!sf) return null;

  if (sf.kind === "circle_content") {
    const href =
      sf.circle_slug && sf.content_id
        ? `/circles/${encodeURIComponent(sf.circle_slug)}/posts/${encodeURIComponent(sf.content_id)}`
        : undefined;
    const label = sf.circle_name
      ? `Shared from ${sf.circle_name}`
      : "Shared from a circle post";
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Share2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">
          {href ? (
            <Link href={href} className="text-primary hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </span>
        {sf.title_snapshot && (
          <span className="max-w-full truncate opacity-80">&ldquo;{sf.title_snapshot}&rdquo;</span>
        )}
        {sharerName && (
          <span className="ml-auto shrink-0 text-muted-foreground">by {sharerName}</span>
        )}
      </div>
    );
  }

  const url = sf.url;
  let host = "link";
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep default */
  }
  const preview = sf.preview;

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-border bg-muted/40">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Share2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">Shared link</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
        >
          {host}
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
        {sharerName && (
          <span className="ml-auto shrink-0 text-muted-foreground">by {sharerName}</span>
        )}
      </div>
      {preview?.image && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block border-t border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.image}
            alt=""
            className="max-h-40 w-full object-cover"
          />
        </a>
      )}
      {(preview?.title || preview?.description) && (
        <div className="space-y-1 border-t border-border px-3 py-2 text-xs">
          {preview.title && <p className="font-medium text-foreground">{preview.title}</p>}
          {preview.description && (
            <p className="line-clamp-2 text-muted-foreground">{preview.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
