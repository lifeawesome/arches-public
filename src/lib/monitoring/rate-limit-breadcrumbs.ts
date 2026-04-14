import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/monitoring/sentry-shared";
import { sanitizeUrlForSentry } from "@/lib/monitoring/sentry-sanitize";

let installed = false;

function add429Breadcrumb(url: string, method: string, source: string) {
  Sentry.addBreadcrumb({
    category: "http",
    type: "http",
    level: "warning",
    data: {
      url: sanitizeUrlForSentry(url),
      method,
      status_code: 429,
      source,
    },
    message: "Rate limited (429)",
  });
}

/**
 * Single client-side hook for 429 responses (Sentry breadcrumbs only; avoids duplicate fetch patching).
 */
export function initRateLimitTracking(): void {
  if (typeof window === "undefined" || installed || !isSentryEnabled()) return;
  installed = true;

  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const [resource, options] = args;
    const url =
      typeof resource === "string"
        ? resource
        : resource instanceof Request
          ? resource.url
          : String(resource);
    const method = options?.method ?? "GET";

    const response = await originalFetch.apply(this, args);
    if (response.status === 429) {
      add429Breadcrumb(url, method, "fetch");
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as unknown as { _sentryMethod?: string; _sentryUrl?: string })._sentryMethod = method;
    (this as unknown as { _sentryMethod?: string; _sentryUrl?: string })._sentryUrl = String(url);
    return originalOpen.apply(this, [method, url, ...rest] as Parameters<typeof originalOpen>);
  };

  XMLHttpRequest.prototype.send = function (...body: unknown[]) {
    const xhr = this as unknown as {
      _sentryMethod?: string;
      _sentryUrl?: string;
    };
    const method = xhr._sentryMethod ?? "GET";
    const url = xhr._sentryUrl ?? "unknown";

    this.addEventListener(
      "load",
      function (this: XMLHttpRequest) {
        if (this.status === 429) {
          add429Breadcrumb(url, method, "XMLHttpRequest");
        }
      },
      { once: true }
    );

    return originalSend.apply(this, body as Parameters<typeof originalSend>);
  };
}
