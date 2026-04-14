/** Max length for error text / extras in production beforeSend (defense in depth). */
const MAX_PROD_TEXT = 2000;

/**
 * Drops query string and hash so tokens in `?access_token=` etc. never reach Sentry.
 */
export function sanitizeUrlForSentry(url: string): string {
  try {
    const u = url.includes("://")
      ? new URL(url)
      : new URL(url, "https://placeholder.invalid");
    return `${u.origin}${u.pathname}`;
  } catch {
    return "[redacted]";
  }
}

export function truncateForSentryProd(text: string, max = MAX_PROD_TEXT): string {
  if (process.env.NODE_ENV !== "production") return text;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated]`;
}
