import { redirect } from "next/navigation";

export function getURL(path: string) {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    "http://localhost:3000/";
  // Make sure to include `https://` when not localhost.
  url = url.includes("http") ? url : `https://${url}`;
  // Make sure to include trailing and leading slash.
  url = url.charAt(url.length - 1) === "/" ? url : `${url}/`;
  return `${url}${path}`;
}

export function getErrorRedirect(
  path: string,
  errorName: string,
  errorMessage: string
) {
  const errorURL = new URL(path, getURL(""));
  errorURL.searchParams.set("error", errorName);
  errorURL.searchParams.set("error_description", errorMessage);
  return errorURL.pathname + errorURL.search;
}

export function getStatusRedirect(
  path: string,
  statusName: string,
  statusMessage: string,
  statusDescription?: string
) {
  const statusURL = new URL(path, getURL(""));
  statusURL.searchParams.set("status", statusName);
  statusURL.searchParams.set("status_description", statusMessage);
  if (statusDescription) {
    statusURL.searchParams.set("status_description", statusDescription);
  }
  return statusURL.pathname + statusURL.search;
}

export function isValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function redirectToPath(path: string) {
  redirect(path);
}

export function toDateTime(secs: number) {
  const t = new Date(1970, 0, 1); // Epoch
  t.setSeconds(secs);
  return t;
}

export function calculateTrialEndUnixTimestamp(trialPeriodDays: number | null | undefined) {
  if (!trialPeriodDays || trialPeriodDays <= 0) return undefined;
  
  const now = new Date();
  const trialEnd = new Date(now.getTime() + trialPeriodDays * 24 * 60 * 60 * 1000);
  return Math.floor(trialEnd.getTime() / 1000);
}
