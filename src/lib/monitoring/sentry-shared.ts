import type { ErrorEvent } from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/monitoring/sentry-scrub-event";

export function getSentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
}

export function isSentryEnabled(): boolean {
  if (
    process.env.NEXT_PUBLIC_SENTRY_ENABLED === "false" ||
    process.env.SENTRY_ENABLED === "false"
  ) {
    return false;
  }
  return Boolean(getSentryDsn());
}

/** Shared options for client, Node server, and Edge Sentry.init. */
export const sharedSentryInitOptions = {
  dsn: getSentryDsn(),
  enabled: isSentryEnabled(),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 0.2 : 0,
  beforeSend(event: ErrorEvent) {
    return scrubSentryEvent(event);
  },
};
