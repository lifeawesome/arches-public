import * as Sentry from "@sentry/nextjs";
import { sharedSentryInitOptions } from "@/lib/monitoring/sentry-shared";

Sentry.init({
  ...sharedSentryInitOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
