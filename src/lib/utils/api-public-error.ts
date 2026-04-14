import { NextResponse } from "next/server";
import {
  reportServerException,
  reportServerMessage,
} from "@/lib/monitoring/report-server-error";

function exposeErrorDetails(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Log and return 500; include `details` only in development. */
export function internalServerError(
  logLabel: string,
  err: unknown,
  publicMessage = "Internal server error"
): NextResponse {
  console.error(logLabel, err);
  reportServerException(logLabel, err);
  const payload: { error: string; details?: string } = { error: publicMessage };
  if (exposeErrorDetails() && err instanceof Error && err.message) {
    payload.details = err.message;
  }
  return NextResponse.json(payload, { status: 500 });
}

/** Log upstream message and return JSON error; include `details` only in development. */
export function upstreamError(
  logLabel: string,
  publicMessage: string,
  upstream: { message: string },
  status = 500
): NextResponse {
  console.error(logLabel, upstream.message);
  reportServerMessage(logLabel, upstream.message);
  const payload: { error: string; details?: string } = { error: publicMessage };
  if (exposeErrorDetails()) {
    payload.details = upstream.message;
  }
  return NextResponse.json(payload, { status });
}
