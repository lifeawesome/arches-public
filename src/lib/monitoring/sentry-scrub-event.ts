import type { ErrorEvent } from "@sentry/nextjs";
import { sanitizeUrlForSentry, truncateForSentryProd } from "@/lib/monitoring/sentry-sanitize";

function scrubHeaders(event: ErrorEvent): void {
  const req = event.request as { headers?: Record<string, unknown> } | undefined;
  if (req?.headers && typeof req.headers === "object") {
    const headers = { ...req.headers };
    delete headers.cookie;
    delete headers.authorization;
    delete headers.Authorization;
    req.headers = headers;
  }
}

function scrubRequestUrl(event: ErrorEvent): void {
  const req = event.request as
    | { url?: string; query_string?: string | Record<string, unknown> }
    | undefined;
  if (!req) return;
  if (typeof req.url === "string") {
    req.url = sanitizeUrlForSentry(req.url);
  }
  if (req.query_string !== undefined) {
    delete req.query_string;
  }
}

function scrubBreadcrumbUrls(event: ErrorEvent): void {
  const ev = event as unknown as { breadcrumbs?: unknown[] };
  const crumbs = ev.breadcrumbs;
  if (!Array.isArray(crumbs)) return;
  for (const b of crumbs) {
    if (b && typeof b === "object" && "data" in b) {
      const data = (b as { data?: Record<string, unknown> }).data;
      if (data && typeof data.url === "string") {
        data.url = sanitizeUrlForSentry(data.url);
      }
    }
  }
}

function truncateExceptionAndMessage(event: ErrorEvent): void {
  if (process.env.NODE_ENV !== "production") return;

  const ex = event.exception as
    | { values?: Array<{ value?: string }> }
    | undefined;
  const values = ex?.values;
  if (values) {
    for (const v of values) {
      if (typeof v.value === "string") {
        v.value = truncateForSentryProd(v.value);
      }
    }
  }

  if (typeof event.message === "string") {
    event.message = truncateForSentryProd(event.message);
  }

  const extra = event.extra as Record<string, unknown> | undefined;
  if (extra) {
    for (const key of Object.keys(extra)) {
      const val = extra[key];
      if (typeof val === "string") {
        extra[key] = truncateForSentryProd(val);
      }
    }
  }
}

/**
 * PII / leakage hardening before events leave the app.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent | null {
  scrubHeaders(event);
  scrubRequestUrl(event);
  scrubBreadcrumbUrls(event);
  truncateExceptionAndMessage(event);
  return event;
}
