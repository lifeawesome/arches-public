"use client";

import { useEffect } from "react";
import { initRateLimitTracking } from "@/lib/monitoring/rate-limit-breadcrumbs";

export function MonitoringInit() {
  useEffect(() => {
    initRateLimitTracking();
  }, []);
  return null;
}
