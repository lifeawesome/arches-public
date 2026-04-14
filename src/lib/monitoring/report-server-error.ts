import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/monitoring/sentry-shared";
import { truncateForSentryProd } from "@/lib/monitoring/sentry-sanitize";

export function reportServerException(logLabel: string, err: unknown): void {
  if (!isSentryEnabled()) return;
  Sentry.withScope((scope) => {
    scope.setTag("source", "api_route");
    scope.setExtra("log_label", logLabel);
    if (err instanceof Error) {
      Sentry.captureException(err);
    } else {
      const msg = truncateForSentryProd(`${logLabel}: ${String(err)}`);
      Sentry.captureMessage(msg, { level: "error" });
    }
  });
}

export function reportServerMessage(logLabel: string, message: string): void {
  if (!isSentryEnabled()) return;
  Sentry.withScope((scope) => {
    scope.setTag("source", "api_route");
    scope.setExtra("log_label", logLabel);
    Sentry.captureMessage(truncateForSentryProd(`${logLabel}: ${message}`), {
      level: "error",
    });
  });
}
